/**
 * Unified decoder module for Squoosh CLI
 * Auto-detects image format based on file extension and decodes accordingly
 */

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

// Ensure ImageData polyfill is available before any codec imports
import '../../utils/image-data.js';

// Individual decoder imports (for internal use in this module)
import { decode as decodeJpegInternal } from './jpeg.js';
import { decode as decodePngInternal } from './png.js';
import { decode as decodeWebpInternal } from './webp.js';
import { decode as decodeAvifInternal } from './avif.js';
import { decode as decodeJxlInternal } from './jxl.js';
import { decode as decodeQoiInternal } from './qoi.js';
import { decode as decodeWp2Internal } from './wp2.js';

// Type for decoder functions
type DecoderFunction = (data: Uint8Array) => Promise<ImageData>;

// Map file extensions to their respective decoders
const decodersByExtension: Record<string, DecoderFunction> = {
  '.jpg': decodeJpegInternal,
  '.jpeg': decodeJpegInternal,
  '.png': decodePngInternal,
  '.webp': decodeWebpInternal,
  '.avif': decodeAvifInternal,
  '.jxl': decodeJxlInternal,
  '.qoi': decodeQoiInternal,
  '.wp2': decodeWp2Internal,
};

/**
 * Decodes an image file to ImageData
 * @param filePath - Path to the image file
 * @returns Promise resolving to ImageData
 * @throws Error if the format is unsupported or decoding fails
 */
export async function decodeFile(filePath: string): Promise<ImageData> {
  const ext = extname(filePath).toLowerCase();
  const decoder = decodersByExtension[ext];

  if (!decoder) {
    throw new Error(
      `Unsupported image format: ${ext}. Supported formats: ${getSupportedExtensions().join(', ')}`,
    );
  }

  const buffer = await readFile(filePath);
  return decoder(new Uint8Array(buffer));
}

/**
 * Decodes image data with explicit format specification
 * @param data - Raw image data as Uint8Array
 * @param format - File extension (e.g., '.png', '.jpg')
 * @returns Promise resolving to ImageData
 * @throws Error if the format is unsupported or decoding fails
 */
export async function decodeBuffer(
  data: Uint8Array,
  format: string,
): Promise<ImageData> {
  const ext = format.startsWith('.') ? format.toLowerCase() : `.${format.toLowerCase()}`;
  const decoder = decodersByExtension[ext];

  if (!decoder) {
    throw new Error(
      `Unsupported image format: ${ext}. Supported formats: ${getSupportedExtensions().join(', ')}`,
    );
  }

  return decoder(data);
}

/**
 * Gets the list of supported file extensions
 * @returns Array of supported extensions (e.g., ['.jpg', '.png', ...])
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(decodersByExtension);
}

/**
 * Checks if a file extension is supported for decoding
 * @param ext - File extension to check (with or without leading dot)
 * @returns true if the format is supported
 */
export function isFormatSupported(ext: string): boolean {
  const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return normalizedExt in decodersByExtension;
}

// Re-export individual decoders for direct use
export { decode as decodeJpeg } from './jpeg.js';
export { decode as decodePng } from './png.js';
export { decode as decodeWebp } from './webp.js';
export { decode as decodeAvif } from './avif.js';
export { decode as decodeJxl } from './jxl.js';
export { decode as decodeQoi } from './qoi.js';
export { decode as decodeWp2 } from './wp2.js';
