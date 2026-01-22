/**
 * Sharp-based high-performance image encoding backend
 * Uses native libvips for significantly faster processing than WASM
 */
export type SharpFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'jxl';
export interface SharpEncodeOptions {
    quality?: number;
    effort?: number;
    lossless?: boolean;
}
/**
 * Check if Sharp backend is available
 */
export declare function isSharpAvailable(): boolean;
/**
 * Get formats supported by Sharp
 */
export declare function getSharpFormats(): SharpFormat[];
/**
 * Check if a format is supported by Sharp
 */
export declare function isFormatSupportedBySharp(format: string): boolean;
/**
 * Encode ImageData using Sharp (high-performance native backend)
 * @param data - ImageData to encode
 * @param format - Output format (webp, avif, mozjpeg, oxipng)
 * @param options - Encoding options
 * @returns Encoded image as ArrayBuffer
 */
export declare function encodeWithSharp(data: ImageData, format: string, options?: SharpEncodeOptions): Promise<ArrayBuffer>;
/**
 * Decode an image file using Sharp
 * @param filePath - Path to the image file
 * @returns ImageData-like object
 */
export declare function decodeWithSharp(filePath: string): Promise<ImageData>;
/**
 * Process a file end-to-end using Sharp (decode + encode)
 * This is the fastest path as it avoids ImageData conversion overhead
 * @param inputPath - Input file path
 * @param format - Output format
 * @param options - Encoding options
 * @returns Encoded image as ArrayBuffer
 */
export declare function processWithSharp(inputPath: string, format: string, options?: SharpEncodeOptions): Promise<ArrayBuffer>;
//# sourceMappingURL=sharp-backend.d.ts.map