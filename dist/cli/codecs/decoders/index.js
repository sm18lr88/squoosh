/**
 * Unified decoder module for Squoosh CLI
 * Auto-detects image format based on file extension and decodes accordingly
 */
import { readFile } from 'fs/promises';
import { extname } from 'path';
// Ensure ImageData polyfill is available before any codec imports
import '../../utils/image-data.js';
// Individual decoder imports
import { decode as decodeJpeg } from './jpeg.js';
import { decode as decodePng } from './png.js';
import { decode as decodeWebp } from './webp.js';
import { decode as decodeAvif } from './avif.js';
import { decode as decodeJxl } from './jxl.js';
import { decode as decodeQoi } from './qoi.js';
import { decode as decodeWp2 } from './wp2.js';
// Map file extensions to their respective decoders
const decodersByExtension = {
    '.jpg': decodeJpeg,
    '.jpeg': decodeJpeg,
    '.png': decodePng,
    '.webp': decodeWebp,
    '.avif': decodeAvif,
    '.jxl': decodeJxl,
    '.qoi': decodeQoi,
    '.wp2': decodeWp2,
};
/**
 * Decodes an image file to ImageData
 * @param filePath - Path to the image file
 * @returns Promise resolving to ImageData
 * @throws Error if the format is unsupported or decoding fails
 */
export async function decodeFile(filePath) {
    const ext = extname(filePath).toLowerCase();
    const decoder = decodersByExtension[ext];
    if (!decoder) {
        throw new Error(`Unsupported image format: ${ext}. Supported formats: ${getSupportedExtensions().join(', ')}`);
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
export async function decodeBuffer(data, format) {
    const ext = format.startsWith('.') ? format.toLowerCase() : `.${format.toLowerCase()}`;
    const decoder = decodersByExtension[ext];
    if (!decoder) {
        throw new Error(`Unsupported image format: ${ext}. Supported formats: ${getSupportedExtensions().join(', ')}`);
    }
    return decoder(data);
}
/**
 * Gets the list of supported file extensions
 * @returns Array of supported extensions (e.g., ['.jpg', '.png', ...])
 */
export function getSupportedExtensions() {
    return Object.keys(decodersByExtension);
}
/**
 * Checks if a file extension is supported for decoding
 * @param ext - File extension to check (with or without leading dot)
 * @returns true if the format is supported
 */
export function isFormatSupported(ext) {
    const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return normalizedExt in decodersByExtension;
}
// Re-export individual decoders for direct use
export { decodeJpeg, decodePng, decodeWebp, decodeAvif, decodeJxl, decodeQoi, decodeWp2, };
