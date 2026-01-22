/**
 * Global test setup for Squoosh test suite
 * This file configures browser API mocks and global test utilities
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// URL.createObjectURL / revokeObjectURL Mocks
// ============================================================================

let objectUrlCounter = 0;
const createdObjectUrls = new Set<string>();

/**
 * Mock implementation of URL.createObjectURL
 */
export function mockCreateObjectURL(blob: Blob): string {
  const url = `blob:http://localhost:3000/${++objectUrlCounter}-${Date.now()}`;
  createdObjectUrls.add(url);
  return url;
}

/**
 * Mock implementation of URL.revokeObjectURL
 */
export function mockRevokeObjectURL(url: string): void {
  createdObjectUrls.delete(url);
}

/**
 * Get all currently active (not revoked) object URLs
 */
export function getActiveObjectUrls(): string[] {
  return Array.from(createdObjectUrls);
}

/**
 * Check if there are any leaked object URLs (created but not revoked)
 */
export function hasLeakedObjectUrls(): boolean {
  return createdObjectUrls.size > 0;
}

/**
 * Clear all tracked object URLs
 */
export function clearObjectUrls(): void {
  createdObjectUrls.clear();
  objectUrlCounter = 0;
}

// ============================================================================
// File System Access API Mocks
// ============================================================================

export interface MockShowOpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

/**
 * Create a mock showOpenFilePicker function
 * @param files - Files to return from the picker
 */
export function createMockShowOpenFilePicker(
  files: Array<{ file: File; handle?: FileSystemFileHandle }>
): (options?: MockShowOpenFilePickerOptions) => Promise<FileSystemFileHandle[]> {
  return vi.fn().mockImplementation(async () => {
    return files.map(({ file, handle }) => {
      if (handle) return handle;
      // Create a basic mock handle if not provided
      return {
        kind: 'file',
        name: file.name,
        getFile: vi.fn().mockResolvedValue(file),
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        }),
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
      } as unknown as FileSystemFileHandle;
    });
  });
}

/**
 * Create a mock showOpenFilePicker that simulates user cancellation
 */
export function createMockShowOpenFilePickerCancelled(): () => Promise<never> {
  return vi.fn().mockRejectedValue(
    Object.assign(new Error('User cancelled'), { name: 'AbortError' })
  );
}

// ============================================================================
// Navigator Mocks
// ============================================================================

/**
 * Mock navigator.hardwareConcurrency
 * @param cores - Number of logical processor cores
 */
export function mockHardwareConcurrency(cores: number): void {
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    value: cores,
    writable: true,
    configurable: true,
  });
}

/**
 * Mock navigator.userAgent
 * @param userAgent - User agent string
 */
export function mockUserAgent(userAgent: string): void {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    writable: true,
    configurable: true,
  });
}

/**
 * Mock navigator.onLine
 * @param online - Whether the browser is online
 */
export function mockOnlineStatus(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    writable: true,
    configurable: true,
  });
}

// ============================================================================
// Window API Mocks
// ============================================================================

/**
 * Setup window.showOpenFilePicker mock
 */
export function setupShowOpenFilePicker(
  mock?: ReturnType<typeof vi.fn>
): ReturnType<typeof vi.fn> {
  const mockFn = mock ?? vi.fn().mockResolvedValue([]);
  (globalThis as any).showOpenFilePicker = mockFn;
  if (globalThis.window !== undefined) {
    (globalThis as any).showOpenFilePicker = mockFn;
  }
  return mockFn;
}

/**
 * Remove window.showOpenFilePicker mock
 */
export function teardownShowOpenFilePicker(): void {
  delete (globalThis as any).showOpenFilePicker;
  if (globalThis.window !== undefined) {
    delete (globalThis as any).showOpenFilePicker;
  }
}

// ============================================================================
// DOM Mocks
// ============================================================================

/**
 * Create a mock DOMParser
 */
export function createMockDOMParser(): DOMParser {
  return {
    parseFromString: vi.fn().mockImplementation((str: string, type: string) => {
      // Return a minimal mock document
      const mockDocument = {
        documentElement: {
          hasAttribute: vi.fn().mockReturnValue(false),
          getAttribute: vi.fn().mockReturnValue(null),
          setAttribute: vi.fn(),
        },
      };
      return mockDocument;
    }),
  } as unknown as DOMParser;
}

/**
 * Create a mock XMLSerializer
 */
export function createMockXMLSerializer(): XMLSerializer {
  return {
    serializeToString: vi.fn().mockReturnValue('<svg></svg>'),
  } as unknown as XMLSerializer;
}

// ============================================================================
// Image and Canvas Mocks
// ============================================================================

/**
 * Create a mock HTMLImageElement
 */
export function createMockImage(
  src: string = '',
  width: number = 100,
  height: number = 100
): HTMLImageElement {
  const img = {
    src,
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    complete: true,
    onload: null as (() => void) | null,
    onerror: null as ((error: Error) => void) | null,
    decode: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return img as unknown as HTMLImageElement;
}

/**
 * Mock Image constructor that immediately completes loading
 */
export function setupMockImageConstructor(): void {
  const OriginalImage = globalThis.Image;

  (globalThis as any).Image = class MockImage {
    src: string = '';
    width: number = 100;
    height: number = 100;
    naturalWidth: number = 100;
    naturalHeight: number = 100;
    complete: boolean = true;
    onload: (() => void) | null = null;
    onerror: ((error: Error) => void) | null = null;

    constructor(width?: number, height?: number) {
      if (width !== undefined) this.width = this.naturalWidth = width;
      if (height !== undefined) this.height = this.naturalHeight = height;

      // Trigger onload asynchronously
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }

    decode(): Promise<void> {
      return Promise.resolve();
    }

    addEventListener(event: string, handler: () => void): void {
      if (event === 'load') this.onload = handler;
      if (event === 'error') this.onerror = handler as any;
    }

    removeEventListener(): void {
      // No-op: not needed for tests
    }
  };

  // Store original for restoration
  (globalThis as any).__OriginalImage = OriginalImage;
}

/**
 * Restore original Image constructor
 */
export function teardownMockImageConstructor(): void {
  if ((globalThis as any).__OriginalImage) {
    globalThis.Image = (globalThis as any).__OriginalImage;
    delete (globalThis as any).__OriginalImage;
  }
}

/**
 * Create a mock HTMLCanvasElement
 */
export function createMockCanvas(
  width: number = 100,
  height: number = 100
): HTMLCanvasElement {
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
      colorSpace: 'srgb',
    }),
    putImageData: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  };

  const canvas = {
    width,
    height,
    getContext: vi.fn().mockReturnValue(context),
    toBlob: vi.fn().mockImplementation((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['mock-canvas-data'], { type: 'image/png' }));
    }),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
  };

  return canvas as unknown as HTMLCanvasElement;
}

// ============================================================================
// Worker Mocks
// ============================================================================

/**
 * Create a mock Worker
 */
export function createMockWorker(): Worker {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  } as unknown as Worker;
}

/**
 * Setup global Worker mock
 */
export function setupMockWorkerConstructor(): void {
  (globalThis as any).Worker = vi.fn().mockImplementation(() => createMockWorker());
}

/**
 * Teardown global Worker mock
 */
export function teardownMockWorkerConstructor(): void {
  delete (globalThis as any).Worker;
}

// ============================================================================
// Global Setup Helpers
// ============================================================================

/**
 * Setup all common browser API mocks
 * Call this in your test setup file or beforeEach
 */
export function setupBrowserMocks(): void {
  // Mock URL methods
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  });

  // Mock navigator.hardwareConcurrency (default to 4 cores)
  mockHardwareConcurrency(4);

  // Setup Image constructor mock
  setupMockImageConstructor();
}

/**
 * Teardown all common browser API mocks
 * Call this in your test cleanup or afterEach
 */
export function teardownBrowserMocks(): void {
  clearObjectUrls();
  teardownShowOpenFilePicker();
  teardownMockImageConstructor();
  teardownMockWorkerConstructor();
  vi.unstubAllGlobals();
}

/**
 * Setup automatic cleanup hooks
 * Use this at the top of test files for automatic mock management
 */
export function setupTestHooks(): void {
  beforeEach(() => {
    setupBrowserMocks();
  });

  afterEach(() => {
    teardownBrowserMocks();
    vi.clearAllMocks();
  });
}

// ============================================================================
// Async Test Helpers
// ============================================================================

/**
 * Wait for a specified amount of time
 * @param ms - Milliseconds to wait
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the next microtask
 */
export function nextTick(): Promise<void> {
  return Promise.resolve();
}

/**
 * Wait for all pending promises to resolve
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run fake timers to completion
 */
export async function runAllTimers(): Promise<void> {
  await vi.runAllTimersAsync();
}

// ============================================================================
// Performance Mocks
// ============================================================================

/**
 * Create a mock performance.now() with controllable time
 */
export function createMockPerformanceNow(startTime: number = 0): () => number {
  let currentTime = startTime;
  return () => currentTime++;
}

/**
 * Setup performance.now mock
 */
export function setupPerformanceMock(startTime: number = 0): void {
  const mockNow = createMockPerformanceNow(startTime);
  vi.stubGlobal('performance', {
    ...performance,
    now: mockNow,
  });
}
