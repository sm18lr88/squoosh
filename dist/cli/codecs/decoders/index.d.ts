/**
 * Unified decoder module for Squoosh CLI
 * Auto-detects image format based on file extension and decodes accordingly
 */
import '../../utils/image-data.js';
import { decode as decodeJpeg } from './jpeg.js';
import { decode as decodePng } from './png.js';
import { decode as decodeWebp } from './webp.js';
import { decode as decodeAvif } from './avif.js';
import { decode as decodeJxl } from './jxl.js';
import { decode as decodeQoi } from './qoi.js';
import { decode as decodeWp2 } from './wp2.js';
/**
 * Decodes an image file to ImageData
 * @param filePath - Path to the image file
 * @returns Promise resolving to ImageData
 * @throws Error if the format is unsupported or decoding fails
 */
export declare function decodeFile(filePath: string): Promise<ImageData>;
/**
 * Decodes image data with explicit format specification
 * @param data - Raw image data as Uint8Array
 * @param format - File extension (e.g., '.png', '.jpg')
 * @returns Promise resolving to ImageData
 * @throws Error if the format is unsupported or decoding fails
 */
export declare function decodeBuffer(data: Uint8Array, format: string): Promise<ImageData>;
/**
 * Gets the list of supported file extensions
 * @returns Array of supported extensions (e.g., ['.jpg', '.png', ...])
 */
export declare function getSupportedExtensions(): string[];
/**
 * Checks if a file extension is supported for decoding
 * @param ext - File extension to check (with or without leading dot)
 * @returns true if the format is supported
 */
export declare function isFormatSupported(ext: string): boolean;
export { decodeJpeg, decodePng, decodeWebp, decodeAvif, decodeJxl, decodeQoi, decodeWp2, };
//# sourceMappingURL=index.d.ts.map