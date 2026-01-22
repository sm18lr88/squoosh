/**
 * Test data factories for Squoosh test suite
 * Provides convenient functions to create test data with sensible defaults
 */

import type { BatchItem, BatchItemStatus, BatchItemResult } from '../client/lazy-app/BatchProcessor/BatchQueue';
import type { FileWithHandle } from '../client/lazy-app/util/fs-access';
import {
  createMockFileSystemFileHandle,
  createPngHeader,
  createJpegHeader,
  createWebpHeader,
  type MockFileSystemFileHandle,
} from './mocks';

// ============================================================================
// File Factories
// ============================================================================

/**
 * Create a mock File with specified properties
 * @param name - File name (default: 'test-image.png')
 * @param size - File size in bytes (default: 1024)
 * @param type - MIME type (default: 'image/png')
 * @param content - Optional file content (auto-generated based on type if not provided)
 */
export function createMockFile(
  name: string = 'test-image.png',
  size: number = 1024,
  type: string = 'image/png',
  content?: ArrayBuffer | Uint8Array | string
): File {
  let fileContent: BlobPart[];

  if (content === undefined) {
    // Generate content based on MIME type with appropriate header
    let header: Uint8Array;
    if (type === 'image/png' || type.endsWith('.png')) {
      header = createPngHeader();
    } else if (type === 'image/jpeg' || type === 'image/jpg' || type.endsWith('.jpg') || type.endsWith('.jpeg')) {
      header = createJpegHeader();
    } else if (type === 'image/webp' || type.endsWith('.webp')) {
      header = createWebpHeader();
    } else {
      header = new Uint8Array(0);
    }

    // Create buffer with header + padding to reach desired size
    const paddingSize = Math.max(0, size - header.length);
    const padding = new Uint8Array(paddingSize);

    // Concatenate header and padding into a single Uint8Array
    const combined = new Uint8Array(header.length + padding.length);
    combined.set(header, 0);
    combined.set(padding, header.length);
    fileContent = [combined];
  } else if (content instanceof Uint8Array) {
    // Create a new Uint8Array to ensure proper typing
    fileContent = [new Uint8Array(content)];
  } else {
    fileContent = [content];
  }

  const file = new File(fileContent, name, {
    type,
    lastModified: Date.now(),
  });

  // Override size if it doesn't match (File size is calculated from content)
  if (file.size !== size) {
    Object.defineProperty(file, 'size', {
      value: size,
      writable: false,
    });
  }

  return file;
}

/**
 * Create a mock PNG file
 */
export function createMockPngFile(
  name: string = 'test-image.png',
  size: number = 1024
): File {
  return createMockFile(name, size, 'image/png');
}

/**
 * Create a mock JPEG file
 */
export function createMockJpegFile(
  name: string = 'test-image.jpg',
  size: number = 2048
): File {
  return createMockFile(name, size, 'image/jpeg');
}

/**
 * Create a mock WebP file
 */
export function createMockWebpFile(
  name: string = 'test-image.webp',
  size: number = 1536
): File {
  return createMockFile(name, size, 'image/webp');
}

/**
 * Create a mock SVG file
 */
export function createMockSvgFile(
  name: string = 'test-image.svg',
  width: number = 100,
  height: number = 100
): File {
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="blue"/>
</svg>`;

  return new File([svgContent], name, {
    type: 'image/svg+xml',
    lastModified: Date.now(),
  });
}

/**
 * Create multiple mock files
 * @param count - Number of files to create
 * @param options - Options for file creation
 */
export function createMockFiles(
  count: number,
  options: {
    prefix?: string;
    extension?: string;
    type?: string;
    size?: number;
  } = {}
): File[] {
  const {
    prefix = 'image',
    extension = 'png',
    type = 'image/png',
    size = 1024,
  } = options;

  return Array.from({ length: count }, (_, i) =>
    createMockFile(`${prefix}-${i + 1}.${extension}`, size + i * 100, type)
  );
}

// ============================================================================
// FileWithHandle Factories
// ============================================================================

/**
 * Create a mock FileWithHandle object
 * @param file - The file (or will create one if not provided)
 * @param handle - Optional FileSystemFileHandle (will create one if not provided)
 */
export function createMockFileWithHandle(
  file?: File,
  handle?: FileSystemFileHandle | MockFileSystemFileHandle | null
): FileWithHandle {
  const mockFile = file ?? createMockFile();

  // If handle is explicitly null, don't include a handle
  if (handle === null) {
    return { file: mockFile };
  }

  const mockHandle = handle ?? createMockFileSystemFileHandle(mockFile);

  return {
    file: mockFile,
    handle: mockHandle as FileSystemFileHandle,
  };
}

/**
 * Create multiple FileWithHandle objects
 */
export function createMockFilesWithHandles(
  count: number,
  options: {
    withHandles?: boolean;
    prefix?: string;
    extension?: string;
    type?: string;
    size?: number;
  } = {}
): FileWithHandle[] {
  const { withHandles = true, ...fileOptions } = options;
  const files = createMockFiles(count, fileOptions);

  return files.map((file) =>
    createMockFileWithHandle(file, withHandles ? undefined : null)
  );
}

// ============================================================================
// BatchItem Factories
// ============================================================================

/**
 * Default values for BatchItem
 */
const defaultBatchItem: BatchItem = {
  id: 'test-item-1',
  file: createMockFile(),
  status: 'pending',
  progress: 0,
};

/**
 * Create a mock BatchItem
 * @param overrides - Properties to override
 */
export function createMockBatchItem(
  overrides: Partial<BatchItem> = {}
): BatchItem {
  const item: BatchItem = {
    ...defaultBatchItem,
    id: overrides.id ?? `batch-item-${Math.random().toString(36).slice(2)}`,
    file: overrides.file ?? createMockFile(),
    ...overrides,
  };

  return item;
}

/**
 * Create a BatchItem in pending status
 */
export function createPendingBatchItem(
  file?: File,
  overrides: Partial<BatchItem> = {}
): BatchItem {
  return createMockBatchItem({
    file,
    status: 'pending',
    progress: 0,
    ...overrides,
  });
}

/**
 * Create a BatchItem in processing status
 */
export function createProcessingBatchItem(
  file?: File,
  progress: number = 50,
  overrides: Partial<BatchItem> = {}
): BatchItem {
  return createMockBatchItem({
    file,
    status: 'processing',
    progress,
    ...overrides,
  });
}

/**
 * Create a BatchItem in complete status with result
 */
export function createCompletedBatchItem(
  file?: File,
  overrides: Partial<BatchItem> = {}
): BatchItem {
  const mockFile = file ?? createMockFile();
  const compressedSize = Math.floor(mockFile.size * 0.7); // 30% reduction

  const result: BatchItemResult = {
    originalSize: mockFile.size,
    compressedSize,
    blob: new Blob(['compressed-data'], { type: mockFile.type }),
    downloadUrl: `blob:http://localhost:3000/mock-url-${Date.now()}`,
    ...overrides.result,
  };

  return createMockBatchItem({
    file: mockFile,
    status: 'complete',
    progress: 100,
    result,
    ...overrides,
  });
}

/**
 * Create a BatchItem in error status
 */
export function createErrorBatchItem(
  file?: File,
  error: string = 'Processing failed',
  overrides: Partial<BatchItem> = {}
): BatchItem {
  return createMockBatchItem({
    file,
    status: 'error',
    progress: 0,
    error,
    ...overrides,
  });
}

/**
 * Create multiple BatchItems with mixed statuses
 */
export function createMockBatchItems(
  count: number,
  statusPattern: BatchItemStatus[] = ['pending']
): BatchItem[] {
  const files = createMockFiles(count);

  return files.map((file, index) => {
    const status = statusPattern[index % statusPattern.length];

    switch (status) {
      case 'complete':
        return createCompletedBatchItem(file);
      case 'error':
        return createErrorBatchItem(file);
      case 'processing':
        return createProcessingBatchItem(file);
      case 'decoding':
        return createMockBatchItem({ file, status: 'decoding', progress: 20 });
      case 'encoding':
        return createMockBatchItem({ file, status: 'encoding', progress: 70 });
      case 'saving':
        return createMockBatchItem({ file, status: 'saving', progress: 90 });
      default:
        return createPendingBatchItem(file);
    }
  });
}

// ============================================================================
// ImageData Factories
// ============================================================================

/**
 * Create a mock ImageData with optional pattern
 * @param width - Image width (default: 100)
 * @param height - Image height (default: 100)
 * @param options - Additional options
 */
export function createMockImageData(
  width: number = 100,
  height: number = 100,
  options: {
    fillColor?: [number, number, number, number]; // RGBA
    pattern?: 'solid' | 'gradient' | 'checkerboard';
  } = {}
): ImageData {
  const { fillColor = [0, 0, 0, 255], pattern = 'solid' } = options;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      switch (pattern) {
        case 'gradient': {
          // Horizontal gradient
          const gradientValue = Math.floor((x / width) * 255);
          data[index] = gradientValue;
          data[index + 1] = gradientValue;
          data[index + 2] = gradientValue;
          data[index + 3] = 255;
          break;
        }

        case 'checkerboard': {
          // 8x8 checkerboard pattern
          const isWhite = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) === 0;
          const value = isWhite ? 255 : 0;
          data[index] = value;
          data[index + 1] = value;
          data[index + 2] = value;
          data[index + 3] = 255;
          break;
        }

        case 'solid':
        default:
          data[index] = fillColor[0];
          data[index + 1] = fillColor[1];
          data[index + 2] = fillColor[2];
          data[index + 3] = fillColor[3];
          break;
      }
    }
  }

  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

/**
 * Create a red test image
 */
export function createRedImageData(width: number = 100, height: number = 100): ImageData {
  return createMockImageData(width, height, { fillColor: [255, 0, 0, 255] });
}

/**
 * Create a green test image
 */
export function createGreenImageData(width: number = 100, height: number = 100): ImageData {
  return createMockImageData(width, height, { fillColor: [0, 255, 0, 255] });
}

/**
 * Create a blue test image
 */
export function createBlueImageData(width: number = 100, height: number = 100): ImageData {
  return createMockImageData(width, height, { fillColor: [0, 0, 255, 255] });
}

/**
 * Create a transparent test image
 */
export function createTransparentImageData(width: number = 100, height: number = 100): ImageData {
  return createMockImageData(width, height, { fillColor: [0, 0, 0, 0] });
}

// ============================================================================
// Encoder/Processor State Factories
// ============================================================================

/**
 * Create default encoder state for testing
 */
export function createDefaultEncoderState(
  type: 'mozJPEG' | 'webP' | 'avif' | 'jxl' | 'oxiPNG' | 'qoi' | 'browserPNG' | 'browserJPEG' | 'browserGIF' | 'wp2' = 'mozJPEG'
): { type: string; options: Record<string, unknown> } {
  const defaultOptions: Record<string, Record<string, unknown>> = {
    mozJPEG: { quality: 75, baseline: false, arithmetic: false, progressive: true, optimize_coding: true, smoothing: 0, color_space: 3, quant_table: 3, trellis_multipass: false, trellis_opt_zero: false, trellis_opt_table: false, trellis_loops: 1, auto_subsample: true, chroma_subsample: 2, separate_chroma_quality: false, chroma_quality: 75 },
    webP: { quality: 75, target_size: 0, target_PSNR: 0, method: 4, sns_strength: 50, filter_strength: 60, filter_sharpness: 0, filter_type: 1, partitions: 0, segments: 4, pass: 1, show_compressed: 0, preprocessing: 0, autofilter: 0, partition_limit: 0, alpha_compression: 1, alpha_filtering: 1, alpha_quality: 100, lossless: 0, exact: 0, image_hint: 0, emulate_jpeg_size: 0, thread_level: 0, low_memory: 0, near_lossless: 100, use_delta_palette: 0, use_sharp_yuv: 0 },
    avif: { cqLevel: 33, cqAlphaLevel: -1, denoiseLevel: 0, tileColsLog2: 0, tileRowsLog2: 0, speed: 6, subsample: 1, chromaDeltaQ: false, sharpness: 0, tune: 0 },
    jxl: { quality: 75, progressive: false, epf: -1, lossyPalette: false, decodingSpeedTier: 0, photonNoiseIso: 0, lossyModular: false },
    oxiPNG: { level: 2, interlace: false },
    qoi: {},
    browserPNG: {},
    browserJPEG: { quality: 0.75 },
    browserGIF: {},
    wp2: { quality: 75, alpha_quality: 75, effort: 5, pass: 1, sns: 50, uv_mode: 0, csp_type: 0, error_diffusion: 0, use_random_matrix: false },
  };

  return {
    type,
    options: defaultOptions[type] ?? {},
  };
}

/**
 * Create default processor state for testing
 */
export function createDefaultProcessorState(): {
  resize: { enabled: boolean; width: number; height: number; method: string; fitMethod: string; premultiply: boolean; linearRGB: boolean };
  quantize: { enabled: boolean; numColors: number; dither: number };
} {
  return {
    resize: {
      enabled: false,
      width: 0,
      height: 0,
      method: 'lanczos3',
      fitMethod: 'stretch',
      premultiply: true,
      linearRGB: true,
    },
    quantize: {
      enabled: false,
      numColors: 256,
      dither: 1,
    },
  };
}

// ============================================================================
// Blob/ArrayBuffer Factories
// ============================================================================

/**
 * Create a mock Blob with specified size
 */
export function createMockBlob(
  size: number = 1024,
  type: string = 'image/png'
): Blob {
  const data = new Uint8Array(size);
  return new Blob([data], { type });
}

/**
 * Create a mock ArrayBuffer with specified size
 */
export function createMockArrayBuffer(size: number = 1024): ArrayBuffer {
  return new ArrayBuffer(size);
}

// ============================================================================
// Event Factories
// ============================================================================

/**
 * Create a mock DragEvent
 */
export function createMockDragEvent(
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  files: File[] = []
): DragEvent {
  const dataTransfer = {
    files,
    items: files.map((file) => ({
      kind: 'file',
      type: file.type,
      getAsFile: () => file,
      getAsFileSystemHandle: () => Promise.resolve(null),
    })),
    types: files.length > 0 ? ['Files'] : [],
    dropEffect: 'none' as const,
    effectAllowed: 'all' as const,
  };

  return {
    type,
    dataTransfer,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as DragEvent;
}

/**
 * Create a mock InputEvent for file input
 */
export function createMockFileInputEvent(files: File[]): Event {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const file of files) yield file;
    },
  };

  return {
    target: {
      files: fileList,
    },
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as Event;
}
