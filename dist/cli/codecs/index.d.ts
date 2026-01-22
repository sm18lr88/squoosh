/**
 * Information about a codec including its metadata and encode function.
 */
export interface CodecInfo {
    /** Internal name identifier for the codec */
    name: string;
    /** Human-readable label for the codec */
    label: string;
    /** MIME type of the output format */
    mimeType: string;
    /** File extension for the output format (without leading dot) */
    extension: string;
    /** Default encoding options for this codec */
    defaultOptions: unknown;
    /** Encode function that converts ImageData to the target format */
    encode: (data: ImageData, options: unknown) => Promise<ArrayBuffer>;
    /** Pre-warm the WASM module for faster first encode */
    warmup: () => Promise<void>;
}
/**
 * Registry of all available encoders.
 * Each encoder is keyed by its internal name.
 */
export declare const encoders: Record<string, CodecInfo>;
/**
 * Get an encoder by its name.
 * @param name - The internal name of the encoder (e.g., 'mozjpeg', 'avif')
 * @returns The codec info if found, undefined otherwise
 */
export declare function getEncoder(name: string): CodecInfo | undefined;
/**
 * List all available encoder names.
 * @returns Array of encoder names
 */
export declare function listEncoders(): string[];
/**
 * Get all encoder information as an array.
 * @returns Array of all codec info objects
 */
export declare function getAllEncoders(): CodecInfo[];
/**
 * Find an encoder by its file extension.
 * @param extension - File extension (with or without leading dot)
 * @returns The codec info if found, undefined otherwise
 */
export declare function getEncoderByExtension(extension: string): CodecInfo | undefined;
/**
 * Find an encoder by its MIME type.
 * @param mimeType - MIME type string
 * @returns The codec info if found, undefined otherwise
 */
export declare function getEncoderByMimeType(mimeType: string): CodecInfo | undefined;
export type { EncodeOptions as MozJPEGEncodeOptions } from './encoders/mozjpeg.js';
export type { EncodeOptions as AVIFEncodeOptions } from './encoders/avif.js';
export type { EncodeOptions as WebPEncodeOptions } from './encoders/webp.js';
export type { EncodeOptions as JXLEncodeOptions } from './encoders/jxl.js';
export type { EncodeOptions as OxiPNGEncodeOptions } from './encoders/oxipng.js';
export type { EncodeOptions as QOIEncodeOptions } from './encoders/qoi.js';
export type { EncodeOptions as WP2EncodeOptions } from './encoders/wp2.js';
export { MozJpegColorSpace } from './encoders/mozjpeg.js';
export { AVIFTune } from './encoders/avif.js';
export { UVMode, Csp } from './encoders/wp2.js';
//# sourceMappingURL=index.d.ts.map