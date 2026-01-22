/**
 * File System Access API utilities for batch processing.
 * Provides functionality to open files with handles and write back to original locations.
 */

// Type declarations for File System Access API (extending existing DOM types)
interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: {
    description?: string;
    accept: Record<string, string[]>;
  }[];
}

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

declare global {
  interface Window {
    showOpenFilePicker?: (
      options?: OpenFilePickerOptions,
    ) => Promise<FileSystemFileHandle[]>;
  }

  interface DataTransferItem {
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  }

  interface FileSystemFileHandle {
    queryPermission?: (
      descriptor?: FileSystemPermissionDescriptor,
    ) => Promise<PermissionState>;
    requestPermission?: (
      descriptor?: FileSystemPermissionDescriptor,
    ) => Promise<PermissionState>;
  }
}

export interface FileWithHandle {
  file: File;
  handle?: FileSystemFileHandle;
}

/**
 * Check if the File System Access API is supported in the current browser.
 */
export function supportsFileSystemAccess(): boolean {
  return typeof globalThis.window?.showOpenFilePicker === 'function';
}

/**
 * Image file types accepted by Squoosh
 */
const IMAGE_TYPES = {
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
};

/**
 * Open files using the File System Access API, returning both files and their handles.
 * Falls back to returning files without handles if API is not supported.
 */
export async function openFilesWithHandles(): Promise<FileWithHandle[]> {
  if (!supportsFileSystemAccess()) {
    throw new Error('File System Access API is not supported');
  }

  try {
    const handles = await globalThis.window!.showOpenFilePicker!({
      multiple: true,
      types: [IMAGE_TYPES],
    });

    const filesWithHandles: FileWithHandle[] = await Promise.all(
      handles.map(async (handle) => ({
        file: await handle.getFile(),
        handle,
      })),
    );

    return filesWithHandles;
  } catch (err) {
    // User cancelled the picker
    if (err instanceof Error && err.name === 'AbortError') {
      return [];
    }
    throw err;
  }
}

/**
 * Save a blob back to the original file handle location.
 * @param handle The file handle to write to
 * @param blob The blob data to write
 */
export async function saveToHandle(
  handle: FileSystemFileHandle,
  blob: Blob,
): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

/**
 * Create files from a traditional file input, without handles.
 * @param files FileList from an input element
 */
export function filesFromFileList(files: FileList | null): FileWithHandle[] {
  if (!files) return [];
  return Array.from(files).map((file) => ({ file }));
}

/**
 * Check if DataTransferItem.getAsFileSystemHandle is supported
 */
export function supportsFileSystemHandleFromDrop(): boolean {
  return (
    typeof DataTransferItem !== 'undefined' &&
    'getAsFileSystemHandle' in DataTransferItem.prototype
  );
}

/**
 * Get files with handles from a drag & drop DataTransfer.
 * Uses the File System Access API when available to get writable handles.
 * @param dataTransfer The DataTransfer from a drop event
 */
export async function filesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<FileWithHandle[]> {
  const items = Array.from(dataTransfer.items);
  const filesWithHandles: FileWithHandle[] = [];

  // Try to get file handles if supported (Chrome 86+)
  if (supportsFileSystemHandleFromDrop()) {
    const handlePromises = items
      .filter((item) => item.kind === 'file')
      .map(async (item) => {
        try {
          const handle = await item.getAsFileSystemHandle?.();
          if (handle?.kind === 'file') {
            const fileHandle = handle as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            return { file, handle: fileHandle };
          }
        } catch {
          // Fall through to regular file extraction
        }
        // Fallback: get file without handle
        const file = item.getAsFile();
        return file ? { file } : null;
      });

    const results = await Promise.all(handlePromises);
    for (const result of results) {
      if (result) filesWithHandles.push(result);
    }
  } else {
    // Fallback: get files without handles
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) filesWithHandles.push({ file });
      }
    }
  }

  return filesWithHandles;
}

/**
 * Check if we have write access to replace the original file.
 * This checks if we have a handle and can create a writable stream.
 */
export async function canReplaceOriginal(
  handle?: FileSystemFileHandle,
): Promise<boolean> {
  if (!handle) return false;

  try {
    // Try to get write permission
    if (!handle.queryPermission) return false;
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') return true;

    // Try to request permission
    if (!handle.requestPermission) return false;
    const request = await handle.requestPermission({ mode: 'readwrite' });
    return request === 'granted';
  } catch {
    return false;
  }
}
