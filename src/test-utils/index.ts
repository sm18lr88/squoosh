/**
 * Test utilities for Squoosh test suite
 *
 * Usage:
 *   import { createMockFile, setupBrowserMocks } from '../test-utils';
 *
 * Or import specific modules:
 *   import { createMockBatchItem } from '../test-utils/factories';
 *   import { createMockWorkerBridge } from '../test-utils/mocks';
 *   import { setupTestHooks } from '../test-utils/setup';
 */

// Re-export all mocks
export {
  // FileSystemFileHandle mocks
  createMockWritableStream,
  createMockFileSystemFileHandle,
  type MockFileSystemFileHandle,
  type MockFileSystemWritableFileStream,

  // DataTransfer mocks
  createMockDataTransferItem,
  createMockDataTransfer,
  type MockDataTransferItem,
  type MockDataTransfer,

  // File/Blob helpers
  createMockImageData as createMockImageBytes,
  createPngHeader,
  createJpegHeader,
  createWebpHeader,
  createMockBlob as createMockBlobFromParts,

  // WorkerBridge mock
  createMockWorkerBridge,
  createMockImageDataObject,
  type MockWorkerBridge,

  // AbortController helpers
  createMockAbortSignal,
  createDelayedAbortController,

  // URL helpers
  createTrackableObjectUrl,
  isObjectUrlCreated,
  getObjectUrlBlob,
  clearTrackedObjectUrls,

  // Canvas mocks
  createMockCanvasContext,
  createMockOffscreenCanvas,
  type MockCanvasRenderingContext2D,
  type MockOffscreenCanvas,
} from './mocks';

// Re-export all setup utilities
export {
  // URL mocks
  mockCreateObjectURL,
  mockRevokeObjectURL,
  getActiveObjectUrls,
  hasLeakedObjectUrls,
  clearObjectUrls,

  // File picker mocks
  createMockShowOpenFilePicker,
  createMockShowOpenFilePickerCancelled,
  setupShowOpenFilePicker,
  teardownShowOpenFilePicker,
  type MockShowOpenFilePickerOptions,

  // Navigator mocks
  mockHardwareConcurrency,
  mockUserAgent,
  mockOnlineStatus,

  // DOM mocks
  createMockDOMParser,
  createMockXMLSerializer,

  // Image/Canvas mocks
  createMockImage,
  setupMockImageConstructor,
  teardownMockImageConstructor,
  createMockCanvas,

  // Worker mocks
  createMockWorker,
  setupMockWorkerConstructor,
  teardownMockWorkerConstructor,

  // Global setup/teardown
  setupBrowserMocks,
  teardownBrowserMocks,
  setupTestHooks,

  // Async helpers
  wait,
  nextTick,
  flushPromises,
  runAllTimers,

  // Performance mocks
  createMockPerformanceNow,
  setupPerformanceMock,
} from './setup';

// Re-export all factories
export {
  // File factories
  createMockFile,
  createMockPngFile,
  createMockJpegFile,
  createMockWebpFile,
  createMockSvgFile,
  createMockFiles,

  // FileWithHandle factories
  createMockFileWithHandle,
  createMockFilesWithHandles,

  // BatchItem factories
  createMockBatchItem,
  createPendingBatchItem,
  createProcessingBatchItem,
  createCompletedBatchItem,
  createErrorBatchItem,
  createMockBatchItems,

  // ImageData factories
  createMockImageData,
  createRedImageData,
  createGreenImageData,
  createBlueImageData,
  createTransparentImageData,

  // Encoder/Processor state factories
  createDefaultEncoderState,
  createDefaultProcessorState,

  // Blob/ArrayBuffer factories
  createMockBlob,
  createMockArrayBuffer,

  // Event factories
  createMockDragEvent,
  createMockFileInputEvent,
} from './factories';
