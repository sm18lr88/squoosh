/**
 * Common mocks for Squoosh test suite
 */

import { vi, type Mock } from 'vitest';

// ============================================================================
// Mock FileSystemFileHandle
// ============================================================================

type PermissionState = 'granted' | 'denied' | 'prompt';

export interface MockFileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile: Mock<() => Promise<File>>;
  createWritable: Mock<() => Promise<MockFileSystemWritableFileStream>>;
  queryPermission: Mock<() => Promise<PermissionState>>;
  requestPermission: Mock<() => Promise<PermissionState>>;
}

export interface MockFileSystemWritableFileStream {
  write: Mock<(data: any) => Promise<void>>;
  close: Mock<() => Promise<void>>;
}

/**
 * Create a mock FileSystemWritableFileStream
 */
export function createMockWritableStream(): MockFileSystemWritableFileStream {
  return {
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock FileSystemFileHandle
 * @param file - The file to return from getFile()
 * @param options - Additional options
 */
export function createMockFileSystemFileHandle(
  file: File,
  options: {
    permission?: PermissionState;
  } = {}
): MockFileSystemFileHandle {
  const { permission = 'granted' } = options;
  const writableStream = createMockWritableStream();

  return {
    kind: 'file',
    name: file.name,
    getFile: vi.fn().mockResolvedValue(file),
    createWritable: vi.fn().mockResolvedValue(writableStream),
    queryPermission: vi.fn().mockResolvedValue(permission),
    requestPermission: vi.fn().mockResolvedValue(permission),
  };
}

// ============================================================================
// Mock DataTransfer and DataTransferItem
// ============================================================================

export interface MockDataTransferItem {
  kind: 'file' | 'string';
  type: string;
  getAsFile: Mock<() => File | null>;
  getAsFileSystemHandle: Mock<() => Promise<FileSystemFileHandle | null>>;
  getAsString: Mock<(callback: (data: string) => void) => void>;
}

export interface MockDataTransfer {
  items: MockDataTransferItem[];
  files: File[];
  types: string[];
  dropEffect: string;
  effectAllowed: string;
}

/**
 * Create a mock DataTransferItem
 * @param file - The file this item represents
 * @param handle - Optional file system handle
 */
export function createMockDataTransferItem(
  file: File,
  handle?: MockFileSystemFileHandle
): MockDataTransferItem {
  return {
    kind: 'file',
    type: file.type,
    getAsFile: vi.fn().mockReturnValue(file),
    getAsFileSystemHandle: handle
      ? vi.fn().mockResolvedValue(handle)
      : vi.fn().mockResolvedValue(null),
    getAsString: vi.fn(),
  };
}

/**
 * Create a mock DataTransfer object
 * @param files - Array of files to include
 * @param handles - Optional map of file names to handles
 */
export function createMockDataTransfer(
  files: File[],
  handles?: Map<string, MockFileSystemFileHandle>
): MockDataTransfer {
  const items = files.map((file) => {
    const handle = handles?.get(file.name);
    return createMockDataTransferItem(file, handle);
  });

  return {
    items,
    files,
    types: ['Files'],
    dropEffect: 'none',
    effectAllowed: 'all',
  };
}

// ============================================================================
// Mock File and Blob helpers
// ============================================================================

/**
 * Create mock image data as a Uint8Array
 * @param size - Size in bytes
 * @param pattern - Optional byte pattern (default: random-ish based on index)
 */
export function createMockImageData(
  size: number,
  pattern?: (index: number) => number
): Uint8Array {
  const data = new Uint8Array(size);
  const patternFn = pattern ?? ((i) => i % 256);
  for (let i = 0; i < size; i++) {
    data[i] = patternFn(i);
  }
  return data;
}

/**
 * Create a minimal valid PNG header (8 bytes)
 * This makes the file recognizable as a PNG for MIME type sniffing
 */
export function createPngHeader(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

/**
 * Create a minimal valid JPEG header
 * This makes the file recognizable as a JPEG for MIME type sniffing
 */
export function createJpegHeader(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
}

/**
 * Create a minimal valid WebP header
 */
export function createWebpHeader(): Uint8Array {
  // RIFF....WEBP
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00, // file size (placeholder)
    0x57, 0x45, 0x42, 0x50, // WEBP
  ]);
}

/**
 * Create a mock Blob with specified content
 */
export function createMockBlob(
  content: BlobPart[],
  type: string
): Blob {
  return new Blob(content, { type });
}

// ============================================================================
// Mock WorkerBridge
// ============================================================================

export interface MockWorkerBridge {
  // Decoders
  avifDecode: Mock<(...args: any[]) => Promise<ImageData>>;
  webpDecode: Mock<(...args: any[]) => Promise<ImageData>>;
  jxlDecode: Mock<(...args: any[]) => Promise<ImageData>>;
  wp2Decode: Mock<(...args: any[]) => Promise<ImageData>>;
  qoiDecode: Mock<(...args: any[]) => Promise<ImageData>>;
  // Encoders
  avifEncode: Mock<(...args: any[]) => Promise<ArrayBuffer>>;
  webpEncode: Mock<(...args: any[]) => Promise<ArrayBuffer>>;
  jxlEncode: Mock<(...args: any[]) => Promise<ArrayBuffer>>;
  wp2Encode: Mock<(...args: any[]) => Promise<ArrayBuffer>>;
  qoiEncode: Mock<(...args: any[]) => Promise<ArrayBuffer>>;
  mozjpegEncode: Mock<(...args: any[]) => Promise<ArrayBuffer>>;
  oxipngEncode: Mock<(...args: any[]) => Promise<ArrayBuffer>>;
  // Processors
  resize: Mock<(...args: any[]) => Promise<ImageData>>;
  quantize: Mock<(...args: any[]) => Promise<ImageData>>;
  rotate: Mock<(...args: any[]) => Promise<ImageData>>;
}

/**
 * Create a mock ImageData object
 * @param width - Width of the image
 * @param height - Height of the image
 * @param fillValue - Optional fill value for all pixels (0-255)
 */
export function createMockImageDataObject(
  width: number,
  height: number,
  fillValue: number = 0
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fillValue !== 0) {
    data.fill(fillValue);
  }
  return {
    width,
    height,
    data,
    colorSpace: 'srgb',
  } as ImageData;
}

/**
 * Create a mock WorkerBridge with all methods mocked
 * @param options - Override default mock implementations
 */
export function createMockWorkerBridge(
  options: {
    decodeResult?: ImageData;
    encodeResult?: ArrayBuffer;
  } = {}
): MockWorkerBridge {
  const defaultImageData = options.decodeResult ?? createMockImageDataObject(100, 100);
  const defaultEncodeResult = options.encodeResult ?? new ArrayBuffer(1000);

  return {
    // Decoders - return ImageData
    avifDecode: vi.fn().mockResolvedValue(defaultImageData),
    webpDecode: vi.fn().mockResolvedValue(defaultImageData),
    jxlDecode: vi.fn().mockResolvedValue(defaultImageData),
    wp2Decode: vi.fn().mockResolvedValue(defaultImageData),
    qoiDecode: vi.fn().mockResolvedValue(defaultImageData),
    // Encoders - return ArrayBuffer
    avifEncode: vi.fn().mockResolvedValue(defaultEncodeResult),
    webpEncode: vi.fn().mockResolvedValue(defaultEncodeResult),
    jxlEncode: vi.fn().mockResolvedValue(defaultEncodeResult),
    wp2Encode: vi.fn().mockResolvedValue(defaultEncodeResult),
    qoiEncode: vi.fn().mockResolvedValue(defaultEncodeResult),
    mozjpegEncode: vi.fn().mockResolvedValue(defaultEncodeResult),
    oxipngEncode: vi.fn().mockResolvedValue(defaultEncodeResult),
    // Processors - return ImageData
    resize: vi.fn().mockResolvedValue(defaultImageData),
    quantize: vi.fn().mockResolvedValue(defaultImageData),
    rotate: vi.fn().mockResolvedValue(defaultImageData),
  };
}

// ============================================================================
// Mock AbortController helpers
// ============================================================================

/**
 * Create a mock AbortSignal that is not aborted
 */
export function createMockAbortSignal(aborted: boolean = false): AbortSignal {
  const controller = new AbortController();
  if (aborted) {
    controller.abort();
  }
  return controller.signal;
}

/**
 * Create an AbortController that aborts after a delay
 * @param delay - Delay in milliseconds
 */
export function createDelayedAbortController(delay: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), delay);
  return controller;
}

// ============================================================================
// Mock URL helpers
// ============================================================================

let objectUrlCounter = 0;
const objectUrlMap = new Map<string, Blob>();

/**
 * Create a trackable object URL for testing
 * This is useful when you need to verify URL.createObjectURL/revokeObjectURL behavior
 */
export function createTrackableObjectUrl(blob: Blob): string {
  const url = `blob:mock-url-${++objectUrlCounter}`;
  objectUrlMap.set(url, blob);
  return url;
}

/**
 * Check if an object URL was created
 */
export function isObjectUrlCreated(url: string): boolean {
  return objectUrlMap.has(url);
}

/**
 * Get the blob associated with a trackable object URL
 */
export function getObjectUrlBlob(url: string): Blob | undefined {
  return objectUrlMap.get(url);
}

/**
 * Clear all tracked object URLs
 */
export function clearTrackedObjectUrls(): void {
  objectUrlMap.clear();
  objectUrlCounter = 0;
}

// ============================================================================
// Mock Canvas and OffscreenCanvas
// ============================================================================

export interface MockCanvasRenderingContext2D {
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  canvas: { width: number; height: number };
}

/**
 * Create a mock CanvasRenderingContext2D
 */
export function createMockCanvasContext(
  width: number = 100,
  height: number = 100
): MockCanvasRenderingContext2D {
  const imageData = createMockImageDataObject(width, height);

  return {
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue(imageData),
    putImageData: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    canvas: { width, height },
  };
}

export interface MockOffscreenCanvas {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  convertToBlob: ReturnType<typeof vi.fn>;
  transferToImageBitmap: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock OffscreenCanvas
 */
export function createMockOffscreenCanvas(
  width: number = 100,
  height: number = 100
): MockOffscreenCanvas {
  const context = createMockCanvasContext(width, height);
  const blob = new Blob(['mock-image-data'], { type: 'image/png' });

  return {
    width,
    height,
    getContext: vi.fn().mockReturnValue(context),
    convertToBlob: vi.fn().mockResolvedValue(blob),
    transferToImageBitmap: vi.fn(),
  };
}
