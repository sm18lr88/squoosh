/**
 * Tests for File System Access API utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Setup minimal browser globals before importing the module
const originalWindow = globalThis.window;
const originalDataTransferItem = (globalThis as any).DataTransferItem;

// Create a mock window object if it doesn't exist
if (globalThis.window === undefined) {
  (globalThis as any).window = {};
}

// Import after setting up globals
import {
  supportsFileSystemAccess,
  openFilesWithHandles,
  saveToHandle,
  filesFromFileList,
  supportsFileSystemHandleFromDrop,
  filesFromDataTransfer,
  canReplaceOriginal,
  FileWithHandle,
} from './fs-access.js';

describe('supportsFileSystemAccess', () => {
  let savedShowOpenFilePicker: any;

  beforeEach(() => {
    savedShowOpenFilePicker = (globalThis as any).window?.showOpenFilePicker;
  });

  afterEach(() => {
    if (savedShowOpenFilePicker !== undefined) {
      (globalThis as any).window.showOpenFilePicker = savedShowOpenFilePicker;
    } else {
      delete (globalThis as any).window.showOpenFilePicker;
    }
  });

  it('should return true when showOpenFilePicker is available', () => {
    (globalThis as any).window.showOpenFilePicker = vi.fn();
    expect(supportsFileSystemAccess()).toBe(true);
  });

  it('should return false when showOpenFilePicker is not available', () => {
    delete (globalThis as any).window.showOpenFilePicker;
    expect(supportsFileSystemAccess()).toBe(false);
  });

  it('should return false when showOpenFilePicker is not a function', () => {
    (globalThis as any).window.showOpenFilePicker = 'not a function';
    expect(supportsFileSystemAccess()).toBe(false);
  });
});

describe('openFilesWithHandles', () => {
  let savedShowOpenFilePicker: any;

  beforeEach(() => {
    savedShowOpenFilePicker = (globalThis as any).window?.showOpenFilePicker;
  });

  afterEach(() => {
    if (savedShowOpenFilePicker !== undefined) {
      (globalThis as any).window.showOpenFilePicker = savedShowOpenFilePicker;
    } else {
      delete (globalThis as any).window.showOpenFilePicker;
    }
  });

  it('should throw error when File System Access API is not supported', async () => {
    delete (globalThis as any).window.showOpenFilePicker;

    await expect(openFilesWithHandles()).rejects.toThrow(
      'File System Access API is not supported',
    );
  });

  it('should return files with handles when picker succeeds', async () => {
    const mockFile1 = new File(['content1'], 'image1.jpg', {
      type: 'image/jpeg',
    });
    const mockFile2 = new File(['content2'], 'image2.png', { type: 'image/png' });

    const mockHandle1 = {
      getFile: vi.fn().mockResolvedValue(mockFile1),
      kind: 'file',
      name: 'image1.jpg',
    } as unknown as FileSystemFileHandle;

    const mockHandle2 = {
      getFile: vi.fn().mockResolvedValue(mockFile2),
      kind: 'file',
      name: 'image2.png',
    } as unknown as FileSystemFileHandle;

    (globalThis as any).window.showOpenFilePicker = vi
      .fn()
      .mockResolvedValue([mockHandle1, mockHandle2]);

    const result = await openFilesWithHandles();

    expect((globalThis as any).window.showOpenFilePicker).toHaveBeenCalledWith({
      multiple: true,
      types: [
        {
          description: 'Image files',
          accept: {
            'image/*': [
              '.jpg',
              '.jpeg',
              '.png',
              '.gif',
              '.webp',
              '.avif',
              '.jxl',
              '.svg',
              '.bmp',
              '.ico',
              '.qoi',
            ],
          },
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].file).toBe(mockFile1);
    expect(result[0].handle).toBe(mockHandle1);
    expect(result[1].file).toBe(mockFile2);
    expect(result[1].handle).toBe(mockHandle2);
  });

  it('should return empty array when user cancels picker (AbortError)', async () => {
    const abortError = new Error('User cancelled');
    abortError.name = 'AbortError';

    (globalThis as any).window.showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(abortError);

    const result = await openFilesWithHandles();

    expect(result).toEqual([]);
  });

  it('should rethrow non-AbortError errors', async () => {
    const securityError = new Error('Security violation');
    securityError.name = 'SecurityError';

    (globalThis as any).window.showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(securityError);

    await expect(openFilesWithHandles()).rejects.toThrow('Security violation');
  });

  it('should handle empty file selection', async () => {
    (globalThis as any).window.showOpenFilePicker = vi
      .fn()
      .mockResolvedValue([]);

    const result = await openFilesWithHandles();

    expect(result).toEqual([]);
  });
});

describe('saveToHandle', () => {
  it('should write blob to file handle and close writable', async () => {
    const mockBlob = new Blob(['test content'], { type: 'image/png' });
    const mockWritable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockHandle = {
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    } as unknown as FileSystemFileHandle;

    await saveToHandle(mockHandle, mockBlob);

    expect(mockHandle.createWritable).toHaveBeenCalled();
    expect(mockWritable.write).toHaveBeenCalledWith(mockBlob);
    expect(mockWritable.close).toHaveBeenCalled();
  });

  it('should close writable even if write fails', async () => {
    const mockBlob = new Blob(['test content'], { type: 'image/png' });
    const mockWritable = {
      write: vi.fn().mockRejectedValue(new Error('Write failed')),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockHandle = {
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    } as unknown as FileSystemFileHandle;

    await expect(saveToHandle(mockHandle, mockBlob)).rejects.toThrow(
      'Write failed',
    );

    expect(mockWritable.close).toHaveBeenCalled();
  });

  it('should propagate createWritable errors', async () => {
    const mockBlob = new Blob(['test content'], { type: 'image/png' });
    const mockHandle = {
      createWritable: vi
        .fn()
        .mockRejectedValue(new Error('Permission denied')),
    } as unknown as FileSystemFileHandle;

    await expect(saveToHandle(mockHandle, mockBlob)).rejects.toThrow(
      'Permission denied',
    );
  });
});

describe('filesFromFileList', () => {
  it('should convert FileList to FileWithHandle array', () => {
    const mockFile1 = new File(['content1'], 'image1.jpg', {
      type: 'image/jpeg',
    });
    const mockFile2 = new File(['content2'], 'image2.png', { type: 'image/png' });

    // Create a mock FileList
    const mockFileList = {
      0: mockFile1,
      1: mockFile2,
      length: 2,
      item: (index: number) => (index === 0 ? mockFile1 : mockFile2),
      [Symbol.iterator]: function* () {
        yield mockFile1;
        yield mockFile2;
      },
    } as unknown as FileList;

    const result = filesFromFileList(mockFileList);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ file: mockFile1 });
    expect(result[1]).toEqual({ file: mockFile2 });
    expect(result[0].handle).toBeUndefined();
    expect(result[1].handle).toBeUndefined();
  });

  it('should return empty array for null FileList', () => {
    const result = filesFromFileList(null);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty FileList', () => {
    const mockFileList = {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    } as unknown as FileList;

    const result = filesFromFileList(mockFileList);
    expect(result).toEqual([]);
  });

  it('should handle single file in FileList', () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });

    const mockFileList = {
      0: mockFile,
      length: 1,
      item: () => mockFile,
      [Symbol.iterator]: function* () {
        yield mockFile;
      },
    } as unknown as FileList;

    const result = filesFromFileList(mockFileList);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ file: mockFile });
  });
});

describe('supportsFileSystemHandleFromDrop', () => {
  let savedDataTransferItem: any;

  beforeEach(() => {
    savedDataTransferItem = (globalThis as any).DataTransferItem;
  });

  afterEach(() => {
    if (savedDataTransferItem !== undefined) {
      (globalThis as any).DataTransferItem = savedDataTransferItem;
    } else {
      delete (globalThis as any).DataTransferItem;
    }
  });

  it('should return true when getAsFileSystemHandle is in prototype', () => {
    // Create a mock DataTransferItem with getAsFileSystemHandle
    class MockDataTransferItem {
      getAsFileSystemHandle() {
        return Promise.resolve(null);
      }
    }
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    expect(supportsFileSystemHandleFromDrop()).toBe(true);
  });

  it('should return false when DataTransferItem is undefined', () => {
    delete (globalThis as any).DataTransferItem;
    expect(supportsFileSystemHandleFromDrop()).toBe(false);
  });

  it('should return false when getAsFileSystemHandle is not in prototype', () => {
    class MockDataTransferItem {}
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    expect(supportsFileSystemHandleFromDrop()).toBe(false);
  });
});

describe('filesFromDataTransfer', () => {
  let savedDataTransferItem: any;

  beforeEach(() => {
    savedDataTransferItem = (globalThis as any).DataTransferItem;
  });

  afterEach(() => {
    if (savedDataTransferItem !== undefined) {
      (globalThis as any).DataTransferItem = savedDataTransferItem;
    } else {
      delete (globalThis as any).DataTransferItem;
    }
  });

  it('should get files with handles when getAsFileSystemHandle is supported', async () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    const mockHandle = {
      kind: 'file',
      getFile: vi.fn().mockResolvedValue(mockFile),
    } as unknown as FileSystemFileHandle;

    // Setup DataTransferItem with getAsFileSystemHandle
    class MockDataTransferItem {
      getAsFileSystemHandle() {
        return Promise.resolve(mockHandle);
      }
    }
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockItem = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFileSystemHandle: vi.fn().mockResolvedValue(mockHandle),
      getAsFile: vi.fn().mockReturnValue(mockFile),
    };

    const mockDataTransfer = {
      items: [mockItem],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe(mockFile);
    expect(result[0].handle).toBe(mockHandle);
  });

  it('should fallback to getAsFile when getAsFileSystemHandle fails', async () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });

    // Setup DataTransferItem with getAsFileSystemHandle
    class MockDataTransferItem {
      getAsFileSystemHandle() {
        return Promise.resolve(null);
      }
    }
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockItem = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFileSystemHandle: vi.fn().mockRejectedValue(new Error('Failed')),
      getAsFile: vi.fn().mockReturnValue(mockFile),
    };

    const mockDataTransfer = {
      items: [mockItem],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe(mockFile);
    expect(result[0].handle).toBeUndefined();
  });

  it('should use getAsFile fallback when getAsFileSystemHandle is not supported', async () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });

    // Setup DataTransferItem without getAsFileSystemHandle
    class MockDataTransferItem {}
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockItem = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFile: vi.fn().mockReturnValue(mockFile),
    };

    const mockDataTransfer = {
      items: [mockItem],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe(mockFile);
    expect(result[0].handle).toBeUndefined();
    expect(mockItem.getAsFile).toHaveBeenCalled();
  });

  it('should filter out non-file items', async () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });

    // Setup DataTransferItem without getAsFileSystemHandle
    class MockDataTransferItem {}
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockFileItem = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFile: vi.fn().mockReturnValue(mockFile),
    };

    const mockStringItem = {
      kind: 'string',
      type: 'text/plain',
      getAsFile: vi.fn().mockReturnValue(null),
    };

    const mockDataTransfer = {
      items: [mockFileItem, mockStringItem],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe(mockFile);
  });

  it('should handle empty DataTransfer', async () => {
    // Setup DataTransferItem without getAsFileSystemHandle
    class MockDataTransferItem {}
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockDataTransfer = {
      items: [],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toEqual([]);
  });

  it('should skip items where getAsFile returns null', async () => {
    // Setup DataTransferItem without getAsFileSystemHandle
    class MockDataTransferItem {}
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockItem = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFile: vi.fn().mockReturnValue(null),
    };

    const mockDataTransfer = {
      items: [mockItem],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toEqual([]);
  });

  it('should handle directory handles by falling back to getAsFile', async () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    const mockDirHandle = {
      kind: 'directory', // Not a file handle
      name: 'folder',
    };

    // Setup DataTransferItem with getAsFileSystemHandle
    class MockDataTransferItem {
      getAsFileSystemHandle() {
        return Promise.resolve(mockDirHandle);
      }
    }
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockItem = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFileSystemHandle: vi.fn().mockResolvedValue(mockDirHandle),
      getAsFile: vi.fn().mockReturnValue(mockFile),
    };

    const mockDataTransfer = {
      items: [mockItem],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe(mockFile);
    expect(result[0].handle).toBeUndefined();
  });

  it('should handle null from getAsFileSystemHandle', async () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });

    // Setup DataTransferItem with getAsFileSystemHandle
    class MockDataTransferItem {
      getAsFileSystemHandle() {
        return Promise.resolve(null);
      }
    }
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockItem = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFileSystemHandle: vi.fn().mockResolvedValue(null),
      getAsFile: vi.fn().mockReturnValue(mockFile),
    };

    const mockDataTransfer = {
      items: [mockItem],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe(mockFile);
    expect(result[0].handle).toBeUndefined();
  });

  it('should handle multiple files with mixed handle availability', async () => {
    const mockFile1 = new File(['content1'], 'image1.jpg', {
      type: 'image/jpeg',
    });
    const mockFile2 = new File(['content2'], 'image2.png', { type: 'image/png' });
    const mockHandle1 = {
      kind: 'file',
      getFile: vi.fn().mockResolvedValue(mockFile1),
    } as unknown as FileSystemFileHandle;

    // Setup DataTransferItem with getAsFileSystemHandle
    class MockDataTransferItem {
      getAsFileSystemHandle() {
        return Promise.resolve(null);
      }
    }
    (globalThis as any).DataTransferItem = MockDataTransferItem;

    const mockItem1 = {
      kind: 'file',
      type: 'image/jpeg',
      getAsFileSystemHandle: vi.fn().mockResolvedValue(mockHandle1),
      getAsFile: vi.fn().mockReturnValue(mockFile1),
    };

    const mockItem2 = {
      kind: 'file',
      type: 'image/png',
      getAsFileSystemHandle: vi.fn().mockRejectedValue(new Error('Failed')),
      getAsFile: vi.fn().mockReturnValue(mockFile2),
    };

    const mockDataTransfer = {
      items: [mockItem1, mockItem2],
    } as unknown as DataTransfer;

    const result = await filesFromDataTransfer(mockDataTransfer);

    expect(result).toHaveLength(2);
    expect(result[0].file).toBe(mockFile1);
    expect(result[0].handle).toBe(mockHandle1);
    expect(result[1].file).toBe(mockFile2);
    expect(result[1].handle).toBeUndefined();
  });
});

describe('canReplaceOriginal', () => {
  it('should return false when handle is undefined', async () => {
    const result = await canReplaceOriginal(undefined);
    expect(result).toBe(false);
  });

  it('should return false when handle is null-ish', async () => {
    const result = await canReplaceOriginal(
      null as unknown as FileSystemFileHandle,
    );
    expect(result).toBe(false);
  });

  it('should return true when queryPermission returns granted', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemFileHandle;

    const result = await canReplaceOriginal(mockHandle);

    expect(result).toBe(true);
    expect(mockHandle.queryPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    });
  });

  it('should request permission when queryPermission returns prompt', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemFileHandle;

    const result = await canReplaceOriginal(mockHandle);

    expect(result).toBe(true);
    expect(mockHandle.requestPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    });
  });

  it('should return false when requestPermission returns denied', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    } as unknown as FileSystemFileHandle;

    const result = await canReplaceOriginal(mockHandle);

    expect(result).toBe(false);
  });

  it('should return false when queryPermission throws', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockRejectedValue(new Error('Not supported')),
    } as unknown as FileSystemFileHandle;

    const result = await canReplaceOriginal(mockHandle);

    expect(result).toBe(false);
  });

  it('should return false when requestPermission throws', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi
        .fn()
        .mockRejectedValue(new Error('User interaction required')),
    } as unknown as FileSystemFileHandle;

    const result = await canReplaceOriginal(mockHandle);

    expect(result).toBe(false);
  });

  it('should handle handle without queryPermission method', async () => {
    const mockHandle = {} as unknown as FileSystemFileHandle;

    const result = await canReplaceOriginal(mockHandle);

    expect(result).toBe(false);
  });

  it('should handle handle with queryPermission but without requestPermission', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
    } as unknown as FileSystemFileHandle;

    const result = await canReplaceOriginal(mockHandle);

    // Should return false because requestPermission returns undefined (not 'granted')
    expect(result).toBe(false);
  });
});

describe('FileWithHandle interface', () => {
  it('should allow file-only objects', () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    const fileWithHandle: FileWithHandle = { file: mockFile };

    expect(fileWithHandle.file).toBe(mockFile);
    expect(fileWithHandle.handle).toBeUndefined();
  });

  it('should allow file with handle objects', () => {
    const mockFile = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    const mockHandle = {
      kind: 'file',
      name: 'image.jpg',
    } as unknown as FileSystemFileHandle;

    const fileWithHandle: FileWithHandle = {
      file: mockFile,
      handle: mockHandle,
    };

    expect(fileWithHandle.file).toBe(mockFile);
    expect(fileWithHandle.handle).toBe(mockHandle);
  });
});
