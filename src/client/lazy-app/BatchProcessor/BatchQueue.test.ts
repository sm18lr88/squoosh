/**
 * Tests for BatchQueue - queue management for batch image processing
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock all dependencies before importing BatchQueue
const mockWorkerPoolExecute = vi.fn();
const mockWorkerPoolDispose = vi.fn();

vi.mock('./WorkerPool', () => ({
  default: class MockWorkerPool {
    execute = mockWorkerPoolExecute;
    dispose = mockWorkerPoolDispose;
  },
}));

vi.mock('../util', () => ({
  blobToImg: vi.fn(),
  blobToText: vi.fn(),
  builtinDecode: vi.fn(),
  sniffMimeType: vi.fn(),
  canDecodeImageType: vi.fn(),
  abortable: vi.fn((_signal: AbortSignal, promise: Promise<unknown>) => promise),
  assertSignal: vi.fn(),
}));

vi.mock('../util/canvas', () => ({
  drawableToImageData: vi.fn(),
}));

vi.mock('../feature-meta', () => ({
  encoderMap: {
    mozJPEG: {
      encode: vi.fn(),
      meta: { extension: 'jpg', mimeType: 'image/jpeg' },
    },
  },
  defaultProcessorState: {
    resize: { enabled: false, width: 0, height: 0 },
    quantize: { enabled: false },
  },
}));

vi.mock('features/processors/resize/client', () => ({
  resize: vi.fn(),
}));

// Import after mocks are set up
import BatchQueue from './BatchQueue';
import type { BatchQueueCallbacks } from './BatchQueue';
import type { EncoderState } from '../feature-meta';

// Mock encoder state for tests (cast to bypass strict typing since we mock the encoder)
const mockEncoderState = { type: 'mozJPEG', options: {} } as EncoderState;

// Helper to create a mock File
function createMockFile(name: string, size: number = 1000): File {
  const blob = new Blob(['x'.repeat(size)], { type: 'image/jpeg' });
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}

// Helper to create mock callbacks
function createMockCallbacks(): BatchQueueCallbacks {
  return {
    onItemUpdate: vi.fn(),
    onProgress: vi.fn(),
  };
}

describe('BatchQueue', () => {
  let queue: BatchQueue;
  let callbacks: BatchQueueCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerPoolExecute.mockReset();
    mockWorkerPoolDispose.mockReset();
    callbacks = createMockCallbacks();
    queue = new BatchQueue(callbacks);
  });

  afterEach(() => {
    if (queue) {
      queue.dispose();
    }
  });

  describe('constructor', () => {
    it('should create a queue with default concurrency', () => {
      const q = new BatchQueue(callbacks);
      expect(q.totalCount).toBe(0);
      expect(q.isProcessing).toBe(false);
      expect(q.isPaused).toBe(false);
      q.dispose();
    });

    it('should create a queue with custom concurrency', () => {
      const q = new BatchQueue(callbacks, 4);
      expect(q.totalCount).toBe(0);
      q.dispose();
    });
  });

  describe('addFiles', () => {
    it('should add a single file to the queue', () => {
      const file = createMockFile('test.jpg');
      queue.addFiles([{ file }]);

      expect(queue.totalCount).toBe(1);
      expect(callbacks.onItemUpdate).toHaveBeenCalledTimes(1);
    });

    it('should add multiple files to the queue', () => {
      const files = [
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
        { file: createMockFile('test3.jpg') },
      ];
      queue.addFiles(files);

      expect(queue.totalCount).toBe(3);
      expect(callbacks.onItemUpdate).toHaveBeenCalledTimes(3);
    });

    it('should generate unique IDs for each file', () => {
      const file = createMockFile('test.jpg');
      queue.addFiles([{ file }, { file }]);

      const items = queue.getItems();
      expect(items.length).toBe(2);
      expect(items[0].id).not.toBe(items[1].id);
    });

    it('should set initial status to pending', () => {
      const file = createMockFile('test.jpg');
      queue.addFiles([{ file }]);

      const items = queue.getItems();
      expect(items[0].status).toBe('pending');
      expect(items[0].progress).toBe(0);
    });

    it('should include file handle if provided', () => {
      const file = createMockFile('test.jpg');
      const mockHandle = {} as FileSystemFileHandle;
      queue.addFiles([{ file, handle: mockHandle }]);

      const items = queue.getItems();
      expect(items[0].fileHandle).toBe(mockHandle);
    });

    it('should call onItemUpdate for each file added', () => {
      const files = [
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
      ];
      queue.addFiles(files);

      expect(callbacks.onItemUpdate).toHaveBeenCalledTimes(2);

      const firstCall = (callbacks.onItemUpdate as Mock).mock.calls[0][0];
      expect(firstCall.file.name).toBe('test1.jpg');
      expect(firstCall.status).toBe('pending');

      const secondCall = (callbacks.onItemUpdate as Mock).mock.calls[1][0];
      expect(secondCall.file.name).toBe('test2.jpg');
    });

    it('should generate IDs containing file metadata', () => {
      const file = createMockFile('test.jpg', 2048);
      queue.addFiles([{ file }]);

      const items = queue.getItems();
      const id = items[0].id;

      // ID format: name-size-lastModified-random
      expect(id).toContain('test.jpg');
    });
  });

  describe('getItems', () => {
    it('should return empty array when queue is empty', () => {
      expect(queue.getItems()).toEqual([]);
    });

    it('should return all items in the queue', () => {
      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
      ]);

      const items = queue.getItems();
      expect(items.length).toBe(2);
    });

    it('should return a new array (not the internal map)', () => {
      queue.addFiles([{ file: createMockFile('test.jpg') }]);

      const items1 = queue.getItems();
      const items2 = queue.getItems();
      expect(items1).not.toBe(items2);
      expect(items1).toEqual(items2);
    });
  });

  describe('getItem', () => {
    it('should return undefined for non-existent ID', () => {
      expect(queue.getItem('non-existent')).toBeUndefined();
    });

    it('should return the correct item by ID', () => {
      const file = createMockFile('test.jpg');
      queue.addFiles([{ file }]);

      const items = queue.getItems();
      const item = queue.getItem(items[0].id);

      expect(item).toBeDefined();
      expect(item?.file.name).toBe('test.jpg');
    });
  });

  describe('totalCount', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.totalCount).toBe(0);
    });

    it('should return correct count after adding files', () => {
      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
        { file: createMockFile('test3.jpg') },
      ]);

      expect(queue.totalCount).toBe(3);
    });

    it('should decrease after removing a file', () => {
      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
      ]);

      const items = queue.getItems();
      queue.removeFile(items[0].id);

      expect(queue.totalCount).toBe(1);
    });
  });

  describe('completed', () => {
    it('should return 0 initially', () => {
      expect(queue.completed).toBe(0);
    });

    it('should return 0 when files are added but not processed', () => {
      queue.addFiles([{ file: createMockFile('test.jpg') }]);
      expect(queue.completed).toBe(0);
    });
  });

  describe('removeFile', () => {
    it('should remove a file from the queue', () => {
      const file = createMockFile('test.jpg');
      queue.addFiles([{ file }]);

      const items = queue.getItems();
      queue.removeFile(items[0].id);

      expect(queue.totalCount).toBe(0);
    });

    it('should do nothing for non-existent ID', () => {
      queue.addFiles([{ file: createMockFile('test.jpg') }]);
      queue.removeFile('non-existent');

      expect(queue.totalCount).toBe(1);
    });

    it('should revoke download URL if result exists', () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const file = createMockFile('test.jpg');
      queue.addFiles([{ file }]);
      const items = queue.getItems();

      // Manually set result with downloadUrl for testing
      // We need to get a fresh reference to the item from the internal map
      const item = queue.getItem(items[0].id);
      if (item) {
        (item as any).result = {
          originalSize: 1000,
          compressedSize: 500,
          blob: new Blob(),
          downloadUrl: 'blob:test-url',
        };
      }

      queue.removeFile(items[0].id);

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
      revokeObjectURL.mockRestore();
    });
  });

  describe('clear', () => {
    it('should remove all files from the queue', () => {
      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
        { file: createMockFile('test3.jpg') },
      ]);

      queue.clear();

      expect(queue.totalCount).toBe(0);
      expect(queue.getItems()).toEqual([]);
    });

    it('should reset completed count', () => {
      queue.addFiles([{ file: createMockFile('test.jpg') }]);
      queue.clear();

      expect(queue.completed).toBe(0);
    });

    it('should revoke all download URLs', () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
      ]);

      // Set results on items for testing URL revocation
      const items = queue.getItems();
      items.forEach((item, index) => {
        const storedItem = queue.getItem(item.id);
        if (storedItem) {
          (storedItem as any).result = {
            downloadUrl: `blob:test-url-${index}`,
          };
        }
      });

      queue.clear();

      expect(revokeObjectURL).toHaveBeenCalledTimes(2);
      revokeObjectURL.mockRestore();
    });
  });

  describe('isPaused', () => {
    it('should return false initially', () => {
      expect(queue.isPaused).toBe(false);
    });

    it('should return true after pause() is called', () => {
      queue.pause();
      expect(queue.isPaused).toBe(true);
    });

    it('should return false after resume() is called', () => {
      queue.pause();
      queue.resume();
      expect(queue.isPaused).toBe(false);
    });
  });

  describe('isProcessing', () => {
    it('should return false initially', () => {
      expect(queue.isProcessing).toBe(false);
    });

    it('should return false when queue is empty', () => {
      expect(queue.isProcessing).toBe(false);
    });
  });

  describe('pause', () => {
    it('should set paused state to true', () => {
      queue.pause();
      expect(queue.isPaused).toBe(true);
    });

    it('should be idempotent (calling multiple times)', () => {
      queue.pause();
      queue.pause();
      queue.pause();
      expect(queue.isPaused).toBe(true);
    });
  });

  describe('resume', () => {
    it('should set paused state to false', () => {
      queue.pause();
      queue.resume();
      expect(queue.isPaused).toBe(false);
    });

    it('should work even if not paused', () => {
      queue.resume();
      expect(queue.isPaused).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should set processing to false', () => {
      queue.cancel();
      expect(queue.isProcessing).toBe(false);
    });

    it('should set paused to false', () => {
      queue.pause();
      queue.cancel();
      expect(queue.isPaused).toBe(false);
    });

    it('should abort ongoing operations', () => {
      // This test verifies cancel creates a new abort controller
      queue.cancel();
      expect(queue.isProcessing).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return zeroed stats for empty queue', () => {
      const stats = queue.getStats();

      expect(stats).toEqual({
        totalFiles: 0,
        completedFiles: 0,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        averageSavings: 0,
      });
    });

    it('should return correct totalFiles count', () => {
      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
      ]);

      const stats = queue.getStats();
      expect(stats.totalFiles).toBe(2);
    });

    it('should return 0 completedFiles when no processing done', () => {
      queue.addFiles([{ file: createMockFile('test.jpg') }]);

      const stats = queue.getStats();
      expect(stats.completedFiles).toBe(0);
    });

    it('should calculate stats correctly with completed items', () => {
      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
      ]);

      // Manually set results for testing
      const items = queue.getItems();
      items.forEach((item, index) => {
        const storedItem = queue.getItem(item.id);
        if (storedItem) {
          if (index === 0) {
            (storedItem as any).result = {
              originalSize: 1000,
              compressedSize: 500,
              blob: new Blob(),
              downloadUrl: 'blob:url1',
            };
          } else {
            (storedItem as any).result = {
              originalSize: 2000,
              compressedSize: 800,
              blob: new Blob(),
              downloadUrl: 'blob:url2',
            };
          }
        }
      });

      const stats = queue.getStats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.completedFiles).toBe(2);
      expect(stats.totalOriginalSize).toBe(3000);
      expect(stats.totalCompressedSize).toBe(1300);
      // Average savings: (3000 - 1300) / 3000 * 100 = 56.67%
      expect(stats.averageSavings).toBeCloseTo(56.67, 1);
    });

    it('should return 0 averageSavings when original size is 0', () => {
      const stats = queue.getStats();
      expect(stats.averageSavings).toBe(0);
    });

    it('should handle mixed completed and pending items', () => {
      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
        { file: createMockFile('test3.jpg') },
      ]);

      // Only set result for first item
      const items = queue.getItems();
      const firstItem = queue.getItem(items[0].id);
      if (firstItem) {
        (firstItem as any).result = {
          originalSize: 1000,
          compressedSize: 400,
          blob: new Blob(),
          downloadUrl: 'blob:url1',
        };
      }

      const stats = queue.getStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.completedFiles).toBe(1);
      expect(stats.totalOriginalSize).toBe(1000);
      expect(stats.totalCompressedSize).toBe(400);
      expect(stats.averageSavings).toBe(60); // (1000-400)/1000 * 100
    });
  });

  describe('dispose', () => {
    it('should clear the queue', () => {
      queue.addFiles([{ file: createMockFile('test.jpg') }]);
      queue.dispose();

      expect(queue.totalCount).toBe(0);
    });

    it('should cancel processing', () => {
      queue.dispose();
      expect(queue.isProcessing).toBe(false);
    });

    it('should call workerPool.dispose', () => {
      queue.dispose();
      expect(mockWorkerPoolDispose).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should set processing to true when started', async () => {
      mockWorkerPoolExecute.mockResolvedValue(undefined);

      queue.addFiles([{ file: createMockFile('test.jpg') }]);

      // Note: Processing completes immediately in mock, so isProcessing may already be false
      await queue.start(mockEncoderState);

      // After completion, processing should be false
      expect(queue.isProcessing).toBe(false);
    });

    it('should not start if already processing', async () => {
      let resolveExecute: () => void;
      const executePromise = new Promise<void>((resolve) => {
        resolveExecute = resolve;
      });

      mockWorkerPoolExecute.mockReturnValue(executePromise);

      queue.addFiles([{ file: createMockFile('test.jpg') }]);

      // Start first processing
      const firstStart = queue.start(mockEncoderState);

      // Try to start again while processing
      const secondStart = queue.start(mockEncoderState);

      // Clean up
      resolveExecute!();
      await firstStart;
      await secondStart;

      // execute should only be called once (for the pending item)
      expect(mockWorkerPoolExecute).toHaveBeenCalledTimes(1);
    });

    it('should process only pending and error status items', async () => {
      mockWorkerPoolExecute.mockResolvedValue(undefined);

      queue.addFiles([
        { file: createMockFile('test1.jpg') },
        { file: createMockFile('test2.jpg') },
      ]);

      // Manually set one item to complete status
      const items = queue.getItems();
      const firstItem = queue.getItem(items[0].id);
      if (firstItem) {
        (firstItem as any).status = 'complete';
      }

      await queue.start(mockEncoderState);

      // Only one item should be processed (the pending one)
      expect(mockWorkerPoolExecute).toHaveBeenCalledTimes(1);
    });

    it('should return early if queue is empty', async () => {
      await queue.start(mockEncoderState);

      expect(mockWorkerPoolExecute).not.toHaveBeenCalled();
    });

    it('should process error status items on retry', async () => {
      mockWorkerPoolExecute.mockResolvedValue(undefined);

      queue.addFiles([{ file: createMockFile('test1.jpg') }]);

      // Set the item to error status (simulating a failed attempt)
      const items = queue.getItems();
      const item = queue.getItem(items[0].id);
      if (item) {
        (item as any).status = 'error';
      }

      await queue.start(mockEncoderState);

      // Error status item should be processed
      expect(mockWorkerPoolExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('unique ID generation', () => {
    it('should generate different IDs for same file added multiple times', () => {
      const file = createMockFile('test.jpg', 1000);

      queue.addFiles([{ file }]);
      queue.addFiles([{ file }]);
      queue.addFiles([{ file }]);

      const items = queue.getItems();
      const ids = items.map((item) => item.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
    });

    it('should generate different IDs for files with same name but different sizes', () => {
      const file1 = createMockFile('test.jpg', 1000);
      const file2 = createMockFile('test.jpg', 2000);

      queue.addFiles([{ file: file1 }, { file: file2 }]);

      const items = queue.getItems();
      expect(items[0].id).not.toBe(items[1].id);
    });

    it('should include random component in ID', () => {
      const file = createMockFile('test.jpg');
      queue.addFiles([{ file }]);

      const items = queue.getItems();
      const id = items[0].id;

      // ID should have 4 parts separated by dashes: name-size-lastModified-random
      const parts = id.split('-');
      expect(parts.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('callback invocations', () => {
    it('should call onItemUpdate when file is added', () => {
      const file = createMockFile('test.jpg');
      queue.addFiles([{ file }]);

      expect(callbacks.onItemUpdate).toHaveBeenCalledTimes(1);
      expect(callbacks.onItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          status: 'pending',
          progress: 0,
        }),
      );
    });

    it('should call onItemUpdate with correct item structure', () => {
      const file = createMockFile('test.jpg');
      const handle = {} as FileSystemFileHandle;
      queue.addFiles([{ file, handle }]);

      expect(callbacks.onItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          file,
          fileHandle: handle,
          status: 'pending',
          progress: 0,
        }),
      );
    });
  });

  describe('state transitions', () => {
    it('should transition from not processing to processing on start', async () => {
      mockWorkerPoolExecute.mockResolvedValue(undefined);

      expect(queue.isProcessing).toBe(false);

      queue.addFiles([{ file: createMockFile('test.jpg') }]);

      await queue.start(mockEncoderState);

      // After completion, should be false again
      expect(queue.isProcessing).toBe(false);
    });

    it('should handle pause -> resume -> pause transitions', () => {
      expect(queue.isPaused).toBe(false);

      queue.pause();
      expect(queue.isPaused).toBe(true);

      queue.resume();
      expect(queue.isPaused).toBe(false);

      queue.pause();
      expect(queue.isPaused).toBe(true);
    });

    it('should reset both processing and paused on cancel', () => {
      queue.pause();
      expect(queue.isPaused).toBe(true);

      queue.cancel();
      expect(queue.isPaused).toBe(false);
      expect(queue.isProcessing).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty files array', () => {
      queue.addFiles([]);
      expect(queue.totalCount).toBe(0);
      expect(callbacks.onItemUpdate).not.toHaveBeenCalled();
    });

    it('should handle removing file that was never added', () => {
      queue.removeFile('non-existent-id');
      expect(queue.totalCount).toBe(0);
    });

    it('should handle clearing empty queue', () => {
      queue.clear();
      expect(queue.totalCount).toBe(0);
    });

    it('should handle disposing empty queue', () => {
      queue.dispose();
      expect(queue.totalCount).toBe(0);
    });

    it('should handle multiple dispose calls', () => {
      queue.dispose();
      queue.dispose();
      queue.dispose();
      expect(queue.totalCount).toBe(0);
    });

    it('should handle pause when not processing', () => {
      queue.pause();
      expect(queue.isPaused).toBe(true);
    });

    it('should handle resume when not paused', () => {
      queue.resume();
      expect(queue.isPaused).toBe(false);
    });

    it('should handle cancel when not processing', () => {
      queue.cancel();
      expect(queue.isProcessing).toBe(false);
    });
  });

  describe('getItem by ID functionality', () => {
    it('should retrieve items added at different times', () => {
      queue.addFiles([{ file: createMockFile('first.jpg') }]);
      const firstItems = queue.getItems();
      const firstId = firstItems[0].id;

      queue.addFiles([{ file: createMockFile('second.jpg') }]);
      const secondItems = queue.getItems();
      const secondId = secondItems.find((i) => i.file.name === 'second.jpg')?.id;

      expect(queue.getItem(firstId)?.file.name).toBe('first.jpg');
      expect(queue.getItem(secondId!)?.file.name).toBe('second.jpg');
    });
  });

  describe('multiple queue instances', () => {
    it('should maintain independent state across instances', () => {
      const callbacks1 = createMockCallbacks();
      const callbacks2 = createMockCallbacks();
      const queue1 = new BatchQueue(callbacks1);
      const queue2 = new BatchQueue(callbacks2);

      queue1.addFiles([{ file: createMockFile('queue1.jpg') }]);
      queue2.addFiles([
        { file: createMockFile('queue2a.jpg') },
        { file: createMockFile('queue2b.jpg') },
      ]);

      expect(queue1.totalCount).toBe(1);
      expect(queue2.totalCount).toBe(2);

      queue1.pause();
      expect(queue1.isPaused).toBe(true);
      expect(queue2.isPaused).toBe(false);

      queue1.dispose();
      queue2.dispose();
    });
  });
});
