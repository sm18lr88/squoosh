import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkSharpServer,
  mapFormat,
  getQuality,
  getServerUrl,
  processViaServer,
  processAndSaveViaServer,
  processBatchViaServer,
  type BatchProgressEvent,
} from './sharp-server';

// ============================================================================
// Pure Function Tests (no mocking needed)
// ============================================================================

describe('mapFormat', () => {
  it('maps mozJPEG to mozjpeg', () => {
    expect(mapFormat('mozJPEG')).toBe('mozjpeg');
  });

  it('maps oxiPNG to oxipng', () => {
    expect(mapFormat('oxiPNG')).toBe('oxipng');
  });

  it('maps webP to webp', () => {
    expect(mapFormat('webP')).toBe('webp');
  });

  it('maps avif to avif', () => {
    expect(mapFormat('avif')).toBe('avif');
  });

  it('maps jxl to jxl', () => {
    expect(mapFormat('jxl')).toBe('jxl');
  });

  it('maps qoi to qoi', () => {
    expect(mapFormat('qoi')).toBe('qoi');
  });

  it('maps wp2 to wp2', () => {
    expect(mapFormat('wp2')).toBe('wp2');
  });

  it('maps browserGIF to gif', () => {
    expect(mapFormat('browserGIF')).toBe('gif');
  });

  it('maps browserJPEG to jpeg', () => {
    expect(mapFormat('browserJPEG')).toBe('jpeg');
  });

  it('maps browserPNG to png', () => {
    expect(mapFormat('browserPNG')).toBe('png');
  });

  it('maps unknown encoder to lowercase', () => {
    expect(mapFormat('UnknownFormat')).toBe('unknownformat');
  });

  it('maps already lowercase unknown encoder', () => {
    expect(mapFormat('customencoder')).toBe('customencoder');
  });
});

describe('getQuality', () => {
  it('extracts quality property when present', () => {
    expect(getQuality({ quality: 85 })).toBe(85);
  });

  it('extracts quality property with value 0', () => {
    expect(getQuality({ quality: 0 })).toBe(0);
  });

  it('extracts quality property with value 100', () => {
    expect(getQuality({ quality: 100 })).toBe(100);
  });

  it('extracts cqLevel and inverts for AVIF (cqLevel 30 -> quality 70)', () => {
    expect(getQuality({ cqLevel: 30 })).toBe(70);
  });

  it('extracts cqLevel and inverts for AVIF (cqLevel 0 -> quality 100)', () => {
    expect(getQuality({ cqLevel: 0 })).toBe(100);
  });

  it('extracts cqLevel and inverts for AVIF (cqLevel 63 -> quality 37)', () => {
    expect(getQuality({ cqLevel: 63 })).toBe(37);
  });

  it('prefers quality over cqLevel when both are present', () => {
    expect(getQuality({ quality: 90, cqLevel: 30 })).toBe(90);
  });

  it('returns default 75 when no quality property exists', () => {
    expect(getQuality({})).toBe(75);
  });

  it('returns default 75 when quality is not a number', () => {
    expect(getQuality({ quality: 'high' })).toBe(75);
  });

  it('returns default 75 when options has unrelated properties', () => {
    expect(getQuality({ effort: 5, lossless: true })).toBe(75);
  });
});

describe('getServerUrl', () => {
  it('returns the correct server URL', () => {
    expect(getServerUrl()).toBe('http://localhost:7331');
  });
});

// ============================================================================
// HTTP Function Tests (mock fetch)
// ============================================================================

describe('checkSharpServer', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock window.setTimeout for the AbortController timeout
    vi.stubGlobal('window', { setTimeout: vi.fn((cb, ms) => globalThis.setTimeout(cb, ms)) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it('returns available:true when server responds OK', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        version: '1.0.0',
        formats: ['mozjpeg', 'webp', 'avif'],
      }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const resultPromise = checkSharpServer();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({
      available: true,
      version: '1.0.0',
      formats: ['mozjpeg', 'webp', 'avif'],
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:7331/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('returns available:false when server responds with non-OK status', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const resultPromise = checkSharpServer();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ available: false });
  });

  it('returns available:false when fetch throws (server not running)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const resultPromise = checkSharpServer();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ available: false });
  });

  it('returns available:false when fetch throws network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const resultPromise = checkSharpServer();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ available: false });
  });
});

describe('processViaServer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct FormData and returns blob with size info', async () => {
    const mockBlob = new Blob(['compressed image data'], { type: 'image/jpeg' });
    const mockHeaders = new Map([
      ['X-Original-Size', '10000'],
      ['X-Compressed-Size', '5000'],
    ]);
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
      headers: {
        get: (name: string) => mockHeaders.get(name) || null,
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const testFile = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });
    const result = await processViaServer(testFile, 'mozJPEG', { quality: 80 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:7331/process',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );

    // Verify FormData contents
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const formData = fetchCall[1]?.body as FormData;
    expect(formData.get('file')).toBe(testFile);
    expect(formData.get('format')).toBe('mozjpeg');
    expect(formData.get('quality')).toBe('80');

    expect(result).toEqual({
      blob: mockBlob,
      originalSize: 10000,
      compressedSize: 5000,
    });
  });

  it('uses default quality when not specified in options', async () => {
    const mockBlob = new Blob(['data'], { type: 'image/webp' });
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
      headers: {
        get: () => null,
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const testFile = new File(['test'], 'test.png', { type: 'image/png' });
    await processViaServer(testFile, 'webP', {});

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const formData = fetchCall[1]?.body as FormData;
    expect(formData.get('quality')).toBe('75'); // default quality
  });

  it('handles missing size headers by using blob size', async () => {
    const mockBlob = new Blob(['compressed'], { type: 'image/jpeg' });
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
      headers: {
        get: () => null,
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const result = await processViaServer(testFile, 'mozJPEG', { quality: 85 });

    expect(result.originalSize).toBe(0);
    expect(result.compressedSize).toBe(mockBlob.size);
  });

  it('throws on server error response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal server error'),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    await expect(processViaServer(testFile, 'mozJPEG', { quality: 80 })).rejects.toThrow(
      'Server error: Internal server error'
    );
  });

  it('throws on server 400 error with message', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('Invalid file format'),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });

    await expect(processViaServer(testFile, 'mozJPEG', { quality: 80 })).rejects.toThrow(
      'Server error: Invalid file format'
    );
  });

  it('uses cqLevel for AVIF encoder', async () => {
    const mockBlob = new Blob(['avif data'], { type: 'image/avif' });
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
      headers: { get: () => null },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const testFile = new File(['test'], 'test.png', { type: 'image/png' });
    await processViaServer(testFile, 'avif', { cqLevel: 25 });

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const formData = fetchCall[1]?.body as FormData;
    expect(formData.get('format')).toBe('avif');
    expect(formData.get('quality')).toBe('75'); // 100 - 25 = 75
  });
});

describe('processAndSaveViaServer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct JSON and returns result', async () => {
    const mockResult = {
      success: true,
      inputPath: '/path/to/input.jpg',
      outputPath: '/path/to/output.jpg',
      originalSize: 10000,
      compressedSize: 5000,
      savings: 5000,
      savingsPercent: '50.00%',
    };
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockResult),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await processAndSaveViaServer(
      '/path/to/input.jpg',
      '/path/to/output.jpg',
      'mozJPEG',
      { quality: 85 }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:7331/process-save',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputPath: '/path/to/input.jpg',
          outputPath: '/path/to/output.jpg',
          format: 'mozjpeg',
          quality: 85,
        }),
      })
    );

    expect(result).toEqual(mockResult);
  });

  it('uses correct format mapping for different encoders', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await processAndSaveViaServer('/in.png', '/out.webp', 'webP', { quality: 90 });

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.format).toBe('webp');
    expect(body.quality).toBe(90);
  });

  it('throws on server error with error message from response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'File not found' }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      processAndSaveViaServer('/nonexistent.jpg', '/out.jpg', 'mozJPEG', { quality: 80 })
    ).rejects.toThrow('File not found');
  });

  it('throws generic error when response has no error message', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      processAndSaveViaServer('/in.jpg', '/out.jpg', 'mozJPEG', { quality: 80 })
    ).rejects.toThrow('Server error');
  });

  it('handles AVIF with cqLevel option', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await processAndSaveViaServer('/in.png', '/out.avif', 'avif', { cqLevel: 20 });

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.format).toBe('avif');
    expect(body.quality).toBe(80); // 100 - 20 = 80
  });
});

describe('processBatchViaServer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses SSE events and calls onProgress for each event', async () => {
    const progressEvents: BatchProgressEvent[] = [];
    const onProgress = vi.fn((event: BatchProgressEvent) => {
      progressEvents.push(event);
    });

    // Create a mock ReadableStream that emits SSE events
    const sseData = [
      'data: {"type":"start","batchId":"batch-123","total":2}\n',
      'data: {"type":"progress","completed":1,"total":2,"file":"file1.jpg","success":true}\n',
      'data: {"type":"progress","completed":2,"total":2,"file":"file2.jpg","success":true}\n',
      'data: {"type":"complete","totalFiles":2,"successCount":2,"failCount":0}\n',
    ].join('\n');

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(sseData) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const files = [
      { inputPath: '/path/file1.jpg', outputPath: '/out/file1.jpg' },
      { inputPath: '/path/file2.jpg', outputPath: '/out/file2.jpg' },
    ];

    await processBatchViaServer(files, 'mozJPEG', { quality: 80 }, onProgress);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:7331/batch',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          format: 'mozjpeg',
          quality: 80,
        }),
      })
    );

    expect(onProgress).toHaveBeenCalledTimes(4);
    expect(progressEvents[0]).toEqual({
      type: 'start',
      batchId: 'batch-123',
      total: 2,
    });
    expect(progressEvents[1]).toEqual({
      type: 'progress',
      completed: 1,
      total: 2,
      file: 'file1.jpg',
      success: true,
    });
    expect(progressEvents[3]).toEqual({
      type: 'complete',
      totalFiles: 2,
      successCount: 2,
      failCount: 0,
    });
  });

  it('resolves on complete event', async () => {
    const onProgress = vi.fn();

    const sseData = 'data: {"type":"complete","totalFiles":1,"successCount":1}\n';
    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(sseData) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    const mockResponse = {
      ok: true,
      body: { getReader: () => mockReader },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      processBatchViaServer([{ inputPath: '/file.jpg' }], 'webP', { quality: 75 }, onProgress)
    ).resolves.toBeUndefined();

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'complete' })
    );
  });

  it('rejects on server error response', async () => {
    const onProgress = vi.fn();

    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Batch processing failed' }),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      processBatchViaServer([{ inputPath: '/file.jpg' }], 'mozJPEG', { quality: 80 }, onProgress)
    ).rejects.toThrow('Batch processing failed');
  });

  it('rejects with generic error when no error message in response', async () => {
    const onProgress = vi.fn();

    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      processBatchViaServer([{ inputPath: '/file.jpg' }], 'mozJPEG', { quality: 80 }, onProgress)
    ).rejects.toThrow('Server error');
  });

  it('rejects when response body is null', async () => {
    const onProgress = vi.fn();

    const mockResponse = {
      ok: true,
      body: null,
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      processBatchViaServer([{ inputPath: '/file.jpg' }], 'mozJPEG', { quality: 80 }, onProgress)
    ).rejects.toThrow('No response body');
  });

  it('handles chunked SSE data across multiple reads', async () => {
    const progressEvents: BatchProgressEvent[] = [];
    const onProgress = vi.fn((event: BatchProgressEvent) => {
      progressEvents.push(event);
    });

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          // First chunk - incomplete line
          return Promise.resolve({
            done: false,
            value: encoder.encode('data: {"type":"start","batch'),
          });
        } else if (readCount === 1) {
          readCount++;
          // Second chunk - completes first line and adds complete event
          return Promise.resolve({
            done: false,
            value: encoder.encode('Id":"123"}\ndata: {"type":"complete"}\n'),
          });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    const mockResponse = {
      ok: true,
      body: { getReader: () => mockReader },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await processBatchViaServer([{ inputPath: '/file.jpg' }], 'mozJPEG', { quality: 80 }, onProgress);

    expect(progressEvents.length).toBe(2);
    expect(progressEvents[0]).toEqual({ type: 'start', batchId: '123' });
    expect(progressEvents[1]).toEqual({ type: 'complete' });
  });

  it('handles progress events with error information', async () => {
    const progressEvents: BatchProgressEvent[] = [];
    const onProgress = vi.fn((event: BatchProgressEvent) => {
      progressEvents.push(event);
    });

    const sseData = [
      'data: {"type":"progress","file":"bad.txt","success":false,"error":"Unsupported format"}\n',
      'data: {"type":"complete","successCount":0,"failCount":1}\n',
    ].join('\n');

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(sseData) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    const mockResponse = {
      ok: true,
      body: { getReader: () => mockReader },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await processBatchViaServer([{ inputPath: '/bad.txt' }], 'mozJPEG', { quality: 80 }, onProgress);

    expect(progressEvents[0]).toEqual({
      type: 'progress',
      file: 'bad.txt',
      success: false,
      error: 'Unsupported format',
    });
  });

  it('ignores malformed JSON in SSE data', async () => {
    const progressEvents: BatchProgressEvent[] = [];
    const onProgress = vi.fn((event: BatchProgressEvent) => {
      progressEvents.push(event);
    });

    const sseData = [
      'data: {invalid json}\n',
      'data: {"type":"complete"}\n',
    ].join('\n');

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(sseData) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    const mockResponse = {
      ok: true,
      body: { getReader: () => mockReader },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await processBatchViaServer([{ inputPath: '/file.jpg' }], 'mozJPEG', { quality: 80 }, onProgress);

    // Should only have the complete event, malformed JSON is ignored
    expect(progressEvents.length).toBe(1);
    expect(progressEvents[0]).toEqual({ type: 'complete' });
  });

  it('ignores non-data lines in SSE stream', async () => {
    const progressEvents: BatchProgressEvent[] = [];
    const onProgress = vi.fn((event: BatchProgressEvent) => {
      progressEvents.push(event);
    });

    const sseData = [
      ': this is a comment\n',
      'event: custom\n',
      'data: {"type":"start"}\n',
      '\n',
      'data: {"type":"complete"}\n',
    ].join('\n');

    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(sseData) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    const mockResponse = {
      ok: true,
      body: { getReader: () => mockReader },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await processBatchViaServer([{ inputPath: '/file.jpg' }], 'mozJPEG', { quality: 80 }, onProgress);

    expect(progressEvents.length).toBe(2);
    expect(progressEvents[0]).toEqual({ type: 'start' });
    expect(progressEvents[1]).toEqual({ type: 'complete' });
  });

  it('rejects when fetch throws a network error', async () => {
    const onProgress = vi.fn();

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      processBatchViaServer([{ inputPath: '/file.jpg' }], 'mozJPEG', { quality: 80 }, onProgress)
    ).rejects.toThrow('Failed to fetch');
  });

  it('resolves when stream ends (done: true) without explicit complete event', async () => {
    const progressEvents: BatchProgressEvent[] = [];
    const onProgress = vi.fn((event: BatchProgressEvent) => {
      progressEvents.push(event);
    });

    const sseData = 'data: {"type":"start"}\n';
    const encoder = new TextEncoder();
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        if (readCount === 0) {
          readCount++;
          return Promise.resolve({ done: false, value: encoder.encode(sseData) });
        }
        // Stream ends without complete event
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    const mockResponse = {
      ok: true,
      body: { getReader: () => mockReader },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      processBatchViaServer([{ inputPath: '/file.jpg' }], 'mozJPEG', { quality: 80 }, onProgress)
    ).resolves.toBeUndefined();

    expect(progressEvents).toEqual([{ type: 'start' }]);
  });
});
