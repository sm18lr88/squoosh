/**
 * Polyfills for Node.js CLI
 * Must be imported before any codec code runs
 *
 * This provides:
 * - Browser-compatible ImageData implementation
 * - __dirname and __filename globals for ESM compatibility with Emscripten modules
 */
export interface ImageDataSettings {
    colorSpace?: PredefinedColorSpace;
}
export type PredefinedColorSpace = 'srgb' | 'display-p3';
export declare class ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace: PredefinedColorSpace;
    /**
     * Creates a new ImageData object.
     *
     * @overload
     * @param sw - Width of the image in pixels
     * @param sh - Height of the image in pixels
     * @param settings - Optional settings including colorSpace
     *
     * @overload
     * @param data - A Uint8ClampedArray containing the RGBA pixel data
     * @param sw - Width of the image in pixels
     * @param sh - Height of the image in pixels (optional, calculated from data length if not provided)
     * @param settings - Optional settings including colorSpace
     */
    constructor(sw: number, sh: number, settings?: ImageDataSettings);
    constructor(data: Uint8ClampedArray, sw: number, sh?: number, settings?: ImageDataSettings);
}
export default ImageData;
//# sourceMappingURL=image-data.d.ts.map