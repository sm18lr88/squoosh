/**
 * BatchQueue manages the queue of files to be processed in batch mode.
 */

// FileSystemFileHandle is declared globally in fs-access.ts
import type { EncoderState, ProcessorState } from '../feature-meta';
import type WorkerBridge from '../worker-bridge';
import WorkerPool from './WorkerPool';
import {
  blobToImg,
  blobToText,
  builtinDecode,
  sniffMimeType,
  canDecodeImageType,
  abortable,
  assertSignal,
} from '../util';
import { drawableToImageData } from '../util/canvas';
import { encoderMap, defaultProcessorState } from '../feature-meta';
import { resize } from 'features/processors/resize/client';
import {
  checkSharpServer,
  processViaServer,
  type SharpServerStatus,
} from '../util/sharp-server';

export type BatchItemStatus =
  | 'pending'
  | 'decoding'
  | 'processing'
  | 'encoding'
  | 'saving'
  | 'complete'
  | 'error';

export interface BatchItemResult {
  readonly originalSize: number;
  readonly compressedSize: number;
  readonly blob: Blob;
  readonly downloadUrl: string;
}

export interface BatchItem {
  readonly id: string;
  readonly file: File;
  readonly fileHandle?: FileSystemFileHandle;
  status: BatchItemStatus;
  progress: number;
  result?: BatchItemResult;
  error?: string;
}

export interface BatchQueueCallbacks {
  readonly onItemUpdate: (item: BatchItem) => void;
  readonly onProgress: (completed: number, total: number) => void;
}

interface SourceImage {
  readonly file: File;
  readonly decoded: ImageData;
  readonly preprocessed: ImageData;
  readonly vectorImage?: HTMLImageElement;
}

/**
 * Decode an image file to ImageData
 */
async function decodeImage(
  signal: AbortSignal,
  blob: Blob,
  workerBridge: WorkerBridge,
): Promise<ImageData> {
  assertSignal(signal);
  const mimeType = await abortable(signal, sniffMimeType(blob));
  const canDecode = await abortable(signal, canDecodeImageType(mimeType));

  try {
    if (!canDecode) {
      if (mimeType === 'image/avif') {
        return await workerBridge.avifDecode(signal, blob);
      }
      if (mimeType === 'image/webp') {
        return await workerBridge.webpDecode(signal, blob);
      }
      if (mimeType === 'image/jxl') {
        return await workerBridge.jxlDecode(signal, blob);
      }
      if (mimeType === 'image/webp2') {
        return await workerBridge.wp2Decode(signal, blob);
      }
      if (mimeType === 'image/qoi') {
        return await workerBridge.qoiDecode(signal, blob);
      }
    }
    return await builtinDecode(signal, blob);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    console.log(err);
    throw new Error("Couldn't decode image");
  }
}

/**
 * Process SVG images to set width/height if not already set
 */
async function processSvg(
  signal: AbortSignal,
  blob: Blob,
): Promise<HTMLImageElement> {
  assertSignal(signal);
  const parser = new DOMParser();
  const text = await abortable(signal, blobToText(blob));
  const document = parser.parseFromString(text, 'image/svg+xml');
  const svg = document.documentElement;

  if (svg.hasAttribute('width') && svg.hasAttribute('height')) {
    return blobToImg(blob);
  }

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox === null) throw new Error('SVG must have width/height or viewBox');

  const viewboxParts = viewBox.split(/\s+/);
  svg.setAttribute('width', viewboxParts[2]);
  svg.setAttribute('height', viewboxParts[3]);

  const serializer = new XMLSerializer();
  const newSource = serializer.serializeToString(document);
  return abortable(
    signal,
    blobToImg(new Blob([newSource], { type: 'image/svg+xml' })),
  );
}

/**
 * Process an image (resize, quantize, etc.)
 */
async function processImage(
  signal: AbortSignal,
  source: SourceImage,
  processorState: ProcessorState,
  workerBridge: WorkerBridge,
): Promise<ImageData> {
  assertSignal(signal);
  let result = source.preprocessed;

  if (processorState.resize.enabled) {
    result = await resize(signal, source, processorState.resize, workerBridge);
  }
  if (processorState.quantize.enabled) {
    result = await workerBridge.quantize(
      signal,
      result,
      processorState.quantize,
    );
  }
  return result;
}

/**
 * Compress an image using the specified encoder
 */
async function compressImage(
  signal: AbortSignal,
  image: ImageData,
  encodeData: EncoderState,
  sourceFilename: string,
  workerBridge: WorkerBridge,
): Promise<File> {
  assertSignal(signal);

  const encoder = encoderMap[encodeData.type];
  const compressedData = await encoder.encode(
    signal,
    workerBridge,
    image,
    encodeData.options as any,
  );

  return new File(
    [compressedData],
    sourceFilename.replace(/\.[^.]*$/, `.${encoder.meta.extension}`),
    { type: encoder.meta.mimeType },
  );
}

export default class BatchQueue {
  private readonly items: Map<string, BatchItem> = new Map();
  private readonly workerPool: WorkerPool;
  private readonly callbacks: BatchQueueCallbacks;
  private abortController: AbortController = new AbortController();
  private paused: boolean = false;
  private processing: boolean = false;
  private completedCount: number = 0;
  private sharpServerStatus: SharpServerStatus = { available: false };
  private sharpServerChecked: boolean = false;

  constructor(callbacks: BatchQueueCallbacks, concurrency?: number) {
    this.callbacks = callbacks;
    this.workerPool = new WorkerPool(concurrency);
    // Check Sharp server availability on construction
    this.checkSharpServerAvailability();
  }

  /**
   * Check if Sharp server is available for faster processing
   */
  private async checkSharpServerAvailability(): Promise<void> {
    this.sharpServerStatus = await checkSharpServer();
    this.sharpServerChecked = true;
  }

  /**
   * Get whether the Sharp server is available
   */
  get useSharpServer(): boolean {
    return this.sharpServerStatus.available;
  }

  /**
   * Get the Sharp server version (if available)
   */
  get sharpServerVersion(): string | undefined {
    return this.sharpServerStatus.version;
  }

  /**
   * Force re-check of Sharp server availability
   */
  async recheckSharpServer(): Promise<SharpServerStatus> {
    await this.checkSharpServerAvailability();
    return this.sharpServerStatus;
  }

  /**
   * Get all batch items as an array
   */
  getItems(): BatchItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get a specific batch item by ID
   */
  getItem(id: string): BatchItem | undefined {
    return this.items.get(id);
  }

  /**
   * Get the total number of items in the queue
   */
  get totalCount(): number {
    return this.items.size;
  }

  /**
   * Get the number of completed items
   */
  get completed(): number {
    return this.completedCount;
  }

  /**
   * Get whether processing is currently paused
   */
  get isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get whether processing is currently running
   */
  get isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Add files to the queue
   */
  addFiles(
    files: Array<{ file: File; handle?: FileSystemFileHandle }>,
  ): void {
    for (const { file, handle } of files) {
      const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
      const item: BatchItem = {
        id,
        file,
        fileHandle: handle,
        status: 'pending',
        progress: 0,
      };
      this.items.set(id, item);
      this.callbacks.onItemUpdate(item);
    }
  }

  /**
   * Remove a file from the queue
   */
  removeFile(id: string): void {
    const item = this.items.get(id);
    if (item?.result?.downloadUrl) {
      URL.revokeObjectURL(item.result.downloadUrl);
    }
    this.items.delete(id);
  }

  /**
   * Clear all files from the queue
   */
  clear(): void {
    this.cancel();
    for (const item of this.items.values()) {
      if (item.result?.downloadUrl) {
        URL.revokeObjectURL(item.result.downloadUrl);
      }
    }
    this.items.clear();
    this.completedCount = 0;
  }

  /**
   * Start processing the queue
   */
  async start(
    encoderState: EncoderState,
    processorState: ProcessorState = defaultProcessorState,
    replaceOriginals: boolean = false,
  ): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    this.paused = false;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const pendingItems = Array.from(this.items.values()).filter(
      (item) => item.status === 'pending' || item.status === 'error',
    );

    // Process items in parallel using the worker pool
    const processPromises = pendingItems.map((item) =>
      this.processItem(item, encoderState, processorState, replaceOriginals, signal),
    );

    await Promise.allSettled(processPromises);

    this.processing = false;
  }

  /**
   * Process a single item
   */
  private async processItem(
    item: BatchItem,
    encoderState: EncoderState,
    processorState: ProcessorState,
    replaceOriginals: boolean,
    signal: AbortSignal,
  ): Promise<void> {
    // Wait if paused
    while (this.paused && !signal.aborted) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
    }

    if (signal.aborted) return;

    // Use Sharp server if available and no processing needed
    // (Sharp server doesn't support resize/quantize yet)
    const needsProcessing =
      processorState.resize.enabled || processorState.quantize.enabled;
    const useServer = this.sharpServerStatus.available && !needsProcessing;

    if (useServer) {
      await this.processItemViaServer(item, encoderState, replaceOriginals, signal);
    } else {
      await this.processItemViaWasm(item, encoderState, processorState, replaceOriginals, signal);
    }
  }

  /**
   * Process a single item via Sharp server (fast native processing)
   */
  private async processItemViaServer(
    item: BatchItem,
    encoderState: EncoderState,
    replaceOriginals: boolean,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      // Processing via server
      this.updateItem(item.id, { status: 'processing', progress: 20 });

      if (signal.aborted) return;

      const result = await processViaServer(
        item.file,
        encoderState.type,
        encoderState.options as Record<string, unknown>,
      );

      if (signal.aborted) return;

      // Create a file from the blob
      const encoder = encoderMap[encoderState.type];
      const compressedFile = new File(
        [result.blob],
        item.file.name.replace(/\.[^.]*$/, `.${encoder.meta.extension}`),
        { type: encoder.meta.mimeType },
      );

      // Saving (if replacing originals)
      if (replaceOriginals && item.fileHandle) {
        this.updateItem(item.id, { status: 'saving', progress: 80 });
        const { saveToHandle } = await import('../util/fs-access');
        await saveToHandle(item.fileHandle, compressedFile);
      }

      // Complete
      const downloadUrl = URL.createObjectURL(compressedFile);
      this.updateItem(item.id, {
        status: 'complete',
        progress: 100,
        result: {
          originalSize: item.file.size,
          compressedSize: compressedFile.size,
          blob: compressedFile,
          downloadUrl,
        },
      });

      this.completedCount++;
      this.callbacks.onProgress(this.completedCount, this.items.size);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      this.updateItem(item.id, {
        status: 'error',
        progress: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Process a single item via WASM workers (fallback)
   */
  private async processItemViaWasm(
    item: BatchItem,
    encoderState: EncoderState,
    processorState: ProcessorState,
    replaceOriginals: boolean,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await this.workerPool.execute(async (workerBridge) => {
        // Decoding
        this.updateItem(item.id, { status: 'decoding', progress: 10 });

        let decoded: ImageData;
        let vectorImage: HTMLImageElement | undefined;

        if (item.file.type.startsWith('image/svg+xml')) {
          vectorImage = await processSvg(signal, item.file);
          decoded = drawableToImageData(vectorImage);
        } else {
          decoded = await decodeImage(signal, item.file, workerBridge);
        }

        const source: SourceImage = {
          file: item.file,
          decoded,
          preprocessed: decoded,
          vectorImage,
        };

        // Processing
        this.updateItem(item.id, { status: 'processing', progress: 40 });

        // Update resize dimensions if not set
        const updatedProcessorState = { ...processorState };
        if (
          processorState.resize.enabled &&
          (processorState.resize.width === 0 ||
            processorState.resize.height === 0)
        ) {
          updatedProcessorState.resize = {
            ...processorState.resize,
            width: decoded.width,
            height: decoded.height,
          };
        }

        const processed = await processImage(
          signal,
          source,
          updatedProcessorState,
          workerBridge,
        );

        // Encoding
        this.updateItem(item.id, { status: 'encoding', progress: 70 });

        const compressedFile = await compressImage(
          signal,
          processed,
          encoderState,
          item.file.name,
          workerBridge,
        );

        // Saving (if replacing originals)
        if (replaceOriginals && item.fileHandle) {
          this.updateItem(item.id, { status: 'saving', progress: 90 });
          const { saveToHandle } = await import('../util/fs-access');
          await saveToHandle(item.fileHandle, compressedFile);
        }

        // Complete
        const downloadUrl = URL.createObjectURL(compressedFile);
        this.updateItem(item.id, {
          status: 'complete',
          progress: 100,
          result: {
            originalSize: item.file.size,
            compressedSize: compressedFile.size,
            blob: compressedFile,
            downloadUrl,
          },
        });

        this.completedCount++;
        this.callbacks.onProgress(this.completedCount, this.items.size);
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      this.updateItem(item.id, {
        status: 'error',
        progress: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Update an item and notify callbacks
   */
  private updateItem(id: string, updates: Partial<BatchItem>): void {
    const item = this.items.get(id);
    if (!item) return;

    const updatedItem = { ...item, ...updates };
    this.items.set(id, updatedItem);
    this.callbacks.onItemUpdate(updatedItem);
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Cancel processing
   */
  cancel(): void {
    this.abortController.abort();
    this.processing = false;
    this.paused = false;
  }

  /**
   * Get total statistics
   */
  getStats(): {
    totalFiles: number;
    completedFiles: number;
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageSavings: number;
  } {
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let completedFiles = 0;

    for (const item of this.items.values()) {
      if (item.result) {
        completedFiles++;
        totalOriginalSize += item.result.originalSize;
        totalCompressedSize += item.result.compressedSize;
      }
    }

    const averageSavings =
      totalOriginalSize > 0
        ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100
        : 0;

    return {
      totalFiles: this.items.size,
      completedFiles,
      totalOriginalSize,
      totalCompressedSize,
      averageSavings,
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.cancel();
    this.clear();
    this.workerPool.dispose();
  }
}
