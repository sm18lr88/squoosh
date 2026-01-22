/**
 * Tests for test utilities to ensure they work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Mocks
  createMockFileSystemFileHandle,
  createMockWritableStream,
  createMockDataTransfer,
  createMockWorkerBridge,
  createMockAbortSignal,
  createPngHeader,
  createJpegHeader,
  createWebpHeader,
  createTrackableObjectUrl,
  isObjectUrlCreated,
  getObjectUrlBlob,
  clearTrackedObjectUrls,
  // Setup
  mockCreateObjectURL,
  mockRevokeObjectURL,
  getActiveObjectUrls,
  hasLeakedObjectUrls,
  clearObjectUrls,
  wait,
  nextTick,
  flushPromises,
  // Factories
  createMockFile,
  createMockPngFile,
  createMockJpegFile,
  createMockWebpFile,
  createMockSvgFile,
  createMockFiles,
  createMockFileWithHandle,
  createMockFilesWithHandles,
  createPendingBatchItem,
  createProcessingBatchItem,
  createCompletedBatchItem,
  createErrorBatchItem,
  createMockBatchItems,
  createMockImageData,
  createRedImageData,
  createDefaultEncoderState,
  createDefaultProcessorState,
  createMockDragEvent,
  createMockFileInputEvent,
} from './index';

describe('Mocks', () => {
  describe('createMockFileSystemFileHandle', () => {
    it('should create a mock handle with correct properties', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const handle = createMockFileSystemFileHandle(file);

      expect(handle.kind).toBe('file');
      expect(handle.name).toBe('test.png');
      expect(handle.getFile).toBeDefined();
      expect(handle.createWritable).toBeDefined();
    });

    it('should return the file from getFile()', async () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const handle = createMockFileSystemFileHandle(file);

      const result = await handle.getFile();
      expect(result).toBe(file);
    });

    it('should create a writable stream', async () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const handle = createMockFileSystemFileHandle(file);

      const writable = await handle.createWritable();
      expect(writable.write).toBeDefined();
      expect(writable.close).toBeDefined();
    });

    it('should handle permission options', async () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const handle = createMockFileSystemFileHandle(file, { permission: 'denied' });

      const permission = await handle.queryPermission();
      expect(permission).toBe('denied');
    });
  });

  describe('createMockWritableStream', () => {
    it('should create a writable stream with write and close methods', () => {
      const stream = createMockWritableStream();

      expect(stream.write).toBeDefined();
      expect(stream.close).toBeDefined();
    });

    it('should have callable write and close', async () => {
      const stream = createMockWritableStream();

      await expect(stream.write('data')).resolves.toBeUndefined();
      await expect(stream.close()).resolves.toBeUndefined();
    });
  });

  describe('createMockDataTransfer', () => {
    it('should create a DataTransfer with files', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const dt = createMockDataTransfer([file]);

      expect(dt.files).toHaveLength(1);
      expect(dt.items).toHaveLength(1);
      expect(dt.types).toContain('Files');
    });

    it('should associate handles with files', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const handle = createMockFileSystemFileHandle(file);
      const handles = new Map([['test.png', handle]]);
      const dt = createMockDataTransfer([file], handles);

      expect(dt.items[0].getAsFileSystemHandle).toBeDefined();
    });
  });

  describe('createMockWorkerBridge', () => {
    it('should create a bridge with all decoder methods', () => {
      const bridge = createMockWorkerBridge();

      expect(bridge.avifDecode).toBeDefined();
      expect(bridge.webpDecode).toBeDefined();
      expect(bridge.jxlDecode).toBeDefined();
      expect(bridge.wp2Decode).toBeDefined();
      expect(bridge.qoiDecode).toBeDefined();
    });

    it('should create a bridge with all encoder methods', () => {
      const bridge = createMockWorkerBridge();

      expect(bridge.avifEncode).toBeDefined();
      expect(bridge.webpEncode).toBeDefined();
      expect(bridge.mozjpegEncode).toBeDefined();
      expect(bridge.oxipngEncode).toBeDefined();
    });

    it('should create a bridge with processor methods', () => {
      const bridge = createMockWorkerBridge();

      expect(bridge.resize).toBeDefined();
      expect(bridge.quantize).toBeDefined();
      expect(bridge.rotate).toBeDefined();
    });

    it('should use custom decode result if provided', async () => {
      const customImageData = { width: 50, height: 50, data: new Uint8ClampedArray(10000) } as ImageData;
      const bridge = createMockWorkerBridge({ decodeResult: customImageData });

      const result = await bridge.avifDecode();
      expect(result).toBe(customImageData);
    });
  });

  describe('createMockAbortSignal', () => {
    it('should create a non-aborted signal by default', () => {
      const signal = createMockAbortSignal();
      expect(signal.aborted).toBe(false);
    });

    it('should create an aborted signal when specified', () => {
      const signal = createMockAbortSignal(true);
      expect(signal.aborted).toBe(true);
    });
  });

  describe('image headers', () => {
    it('should create valid PNG header', () => {
      const header = createPngHeader();
      expect(header[0]).toBe(0x89);
      expect(header[1]).toBe(0x50); // P
      expect(header[2]).toBe(0x4e); // N
      expect(header[3]).toBe(0x47); // G
    });

    it('should create valid JPEG header', () => {
      const header = createJpegHeader();
      expect(header[0]).toBe(0xff);
      expect(header[1]).toBe(0xd8);
      expect(header[2]).toBe(0xff);
    });

    it('should create valid WebP header', () => {
      const header = createWebpHeader();
      // RIFF
      expect(header[0]).toBe(0x52);
      expect(header[1]).toBe(0x49);
      expect(header[2]).toBe(0x46);
      expect(header[3]).toBe(0x46);
    });
  });

  describe('trackable object URLs', () => {
    beforeEach(() => {
      clearTrackedObjectUrls();
    });

    it('should create trackable URLs', () => {
      const blob = new Blob(['test']);
      const url = createTrackableObjectUrl(blob);

      expect(url).toMatch(/^blob:mock-url-/);
      expect(isObjectUrlCreated(url)).toBe(true);
    });

    it('should track blob association', () => {
      const blob = new Blob(['test']);
      const url = createTrackableObjectUrl(blob);

      expect(getObjectUrlBlob(url)).toBe(blob);
    });

    it('should clear tracked URLs', () => {
      const blob = new Blob(['test']);
      const url = createTrackableObjectUrl(blob);

      clearTrackedObjectUrls();
      expect(isObjectUrlCreated(url)).toBe(false);
    });
  });
});

describe('Setup utilities', () => {
  describe('URL mocks', () => {
    beforeEach(() => {
      clearObjectUrls();
    });

    it('should create mock object URLs', () => {
      const blob = new Blob(['test']);
      const url = mockCreateObjectURL(blob);

      expect(url).toMatch(/^blob:http:\/\/localhost:3000\//);
      expect(getActiveObjectUrls()).toContain(url);
    });

    it('should revoke object URLs', () => {
      const blob = new Blob(['test']);
      const url = mockCreateObjectURL(blob);

      mockRevokeObjectURL(url);
      expect(getActiveObjectUrls()).not.toContain(url);
    });

    it('should detect leaked URLs', () => {
      const blob = new Blob(['test']);
      mockCreateObjectURL(blob);

      expect(hasLeakedObjectUrls()).toBe(true);
    });

    it('should clear all URLs', () => {
      mockCreateObjectURL(new Blob(['1']));
      mockCreateObjectURL(new Blob(['2']));

      clearObjectUrls();
      expect(hasLeakedObjectUrls()).toBe(false);
    });
  });

  describe('async helpers', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await wait(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('should resolve on next tick', async () => {
      let resolved = false;
      nextTick().then(() => { resolved = true; });

      await Promise.resolve();
      expect(resolved).toBe(true);
    });

    it('should flush promises', async () => {
      let resolved = false;
      Promise.resolve().then(() => { resolved = true; });

      await flushPromises();
      expect(resolved).toBe(true);
    });
  });
});

describe('Factories', () => {
  describe('createMockFile', () => {
    it('should create a file with default values', () => {
      const file = createMockFile();

      expect(file.name).toBe('test-image.png');
      expect(file.type).toBe('image/png');
    });

    it('should create a file with custom name and size', () => {
      const file = createMockFile('custom.jpg', 2048, 'image/jpeg');

      expect(file.name).toBe('custom.jpg');
      expect(file.type).toBe('image/jpeg');
    });

    it('should create a file with custom content', () => {
      const content = new Uint8Array([1, 2, 3, 4]);
      const file = createMockFile('test.bin', 4, 'application/octet-stream', content);

      expect(file.name).toBe('test.bin');
    });
  });

  describe('image file factories', () => {
    it('should create PNG file', () => {
      const file = createMockPngFile();
      expect(file.type).toBe('image/png');
      expect(file.name).toMatch(/\.png$/);
    });

    it('should create JPEG file', () => {
      const file = createMockJpegFile();
      expect(file.type).toBe('image/jpeg');
      expect(file.name).toMatch(/\.jpg$/);
    });

    it('should create WebP file', () => {
      const file = createMockWebpFile();
      expect(file.type).toBe('image/webp');
      expect(file.name).toMatch(/\.webp$/);
    });

    it('should create SVG file with dimensions', () => {
      const file = createMockSvgFile('test.svg', 200, 150);
      expect(file.type).toBe('image/svg+xml');
    });
  });

  describe('createMockFiles', () => {
    it('should create multiple files', () => {
      const files = createMockFiles(3);

      expect(files).toHaveLength(3);
      expect(files[0].name).toMatch(/image-1/);
      expect(files[1].name).toMatch(/image-2/);
      expect(files[2].name).toMatch(/image-3/);
    });

    it('should use custom options', () => {
      const files = createMockFiles(2, { prefix: 'photo', extension: 'jpg', type: 'image/jpeg' });

      expect(files[0].name).toBe('photo-1.jpg');
      expect(files[0].type).toBe('image/jpeg');
    });
  });

  describe('createMockFileWithHandle', () => {
    it('should create file with handle', () => {
      const result = createMockFileWithHandle();

      expect(result.file).toBeDefined();
      expect(result.handle).toBeDefined();
    });

    it('should create file without handle when null', () => {
      const file = createMockFile();
      const result = createMockFileWithHandle(file, null);

      expect(result.file).toBe(file);
      expect(result.handle).toBeUndefined();
    });
  });

  describe('createMockFilesWithHandles', () => {
    it('should create files with handles', () => {
      const files = createMockFilesWithHandles(3);

      expect(files).toHaveLength(3);
      files.forEach(f => {
        expect(f.file).toBeDefined();
        expect(f.handle).toBeDefined();
      });
    });

    it('should create files without handles when specified', () => {
      const files = createMockFilesWithHandles(2, { withHandles: false });

      files.forEach(f => {
        expect(f.file).toBeDefined();
        expect(f.handle).toBeUndefined();
      });
    });
  });

  describe('BatchItem factories', () => {
    it('should create pending batch item', () => {
      const item = createPendingBatchItem();

      expect(item.status).toBe('pending');
      expect(item.progress).toBe(0);
    });

    it('should create processing batch item', () => {
      const item = createProcessingBatchItem(undefined, 75);

      expect(item.status).toBe('processing');
      expect(item.progress).toBe(75);
    });

    it('should create completed batch item with result', () => {
      const item = createCompletedBatchItem();

      expect(item.status).toBe('complete');
      expect(item.progress).toBe(100);
      expect(item.result).toBeDefined();
      expect(item.result!.downloadUrl).toBeDefined();
    });

    it('should create error batch item', () => {
      const item = createErrorBatchItem(undefined, 'Test error');

      expect(item.status).toBe('error');
      expect(item.error).toBe('Test error');
    });

    it('should create batch items with mixed statuses', () => {
      const items = createMockBatchItems(4, ['pending', 'processing', 'complete', 'error']);

      expect(items[0].status).toBe('pending');
      expect(items[1].status).toBe('processing');
      expect(items[2].status).toBe('complete');
      expect(items[3].status).toBe('error');
    });
  });

  describe('ImageData factories', () => {
    it('should create ImageData with correct dimensions', () => {
      const imageData = createMockImageData(50, 30);

      expect(imageData.width).toBe(50);
      expect(imageData.height).toBe(30);
      expect(imageData.data.length).toBe(50 * 30 * 4);
    });

    it('should create solid color ImageData', () => {
      const imageData = createMockImageData(2, 2, { fillColor: [255, 0, 0, 255] });

      // Check first pixel is red
      expect(imageData.data[0]).toBe(255); // R
      expect(imageData.data[1]).toBe(0);   // G
      expect(imageData.data[2]).toBe(0);   // B
      expect(imageData.data[3]).toBe(255); // A
    });

    it('should create red ImageData', () => {
      const imageData = createRedImageData(10, 10);

      expect(imageData.data[0]).toBe(255);
      expect(imageData.data[1]).toBe(0);
      expect(imageData.data[2]).toBe(0);
    });
  });

  describe('Encoder/Processor state factories', () => {
    it('should create encoder state', () => {
      const state = createDefaultEncoderState('mozJPEG');

      expect(state.type).toBe('mozJPEG');
      expect(state.options).toBeDefined();
    });

    it('should create processor state', () => {
      const state = createDefaultProcessorState();

      expect(state.resize).toBeDefined();
      expect(state.quantize).toBeDefined();
      expect(state.resize.enabled).toBe(false);
      expect(state.quantize.enabled).toBe(false);
    });
  });

  describe('Event factories', () => {
    it('should create drag event', () => {
      const file = createMockFile();
      const event = createMockDragEvent('drop', [file]);

      expect(event.type).toBe('drop');
      expect(event.dataTransfer!.files).toContain(file);
    });

    it('should create file input event', () => {
      const files = [createMockFile(), createMockFile()];
      const event = createMockFileInputEvent(files);

      expect((event.target as any).files.length).toBe(2);
    });
  });
});
