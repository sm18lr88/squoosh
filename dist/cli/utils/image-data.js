/**
 * Polyfills for Node.js CLI
 * Must be imported before any codec code runs
 *
 * This provides:
 * - Browser-compatible ImageData implementation
 * - __dirname and __filename globals for ESM compatibility with Emscripten modules
 */
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';
// Polyfill __filename and __dirname for ESM compatibility
// These are needed by Emscripten-generated modules that expect CommonJS globals
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const g = globalThis;
if (typeof g.__filename === 'undefined') {
    g.__filename = __filename;
}
if (typeof g.__dirname === 'undefined') {
    g.__dirname = __dirname;
}
// Also provide a require function for modules that need it
if (typeof g.require === 'undefined') {
    g.require = createRequire(import.meta.url);
}
export class ImageData {
    data;
    width;
    height;
    colorSpace;
    constructor(dataOrWidth, widthOrHeight, heightOrSettings, settings) {
        if (typeof dataOrWidth === 'number') {
            // Constructor: new ImageData(width, height, settings?)
            const width = dataOrWidth;
            const height = widthOrHeight;
            const opts = typeof heightOrSettings === 'object' ? heightOrSettings : undefined;
            if (!Number.isInteger(width) || width <= 0) {
                throw new RangeError(`Failed to construct 'ImageData': The width is zero or not a number.`);
            }
            if (!Number.isInteger(height) || height <= 0) {
                throw new RangeError(`Failed to construct 'ImageData': The height is zero or not a number.`);
            }
            this.width = width;
            this.height = height;
            this.data = new Uint8ClampedArray(width * height * 4);
            this.colorSpace = opts?.colorSpace ?? 'srgb';
        }
        else {
            // Constructor: new ImageData(data, width, height?, settings?)
            const data = dataOrWidth;
            const width = widthOrHeight;
            let height;
            let opts;
            if (typeof heightOrSettings === 'number') {
                height = heightOrSettings;
                opts = settings;
            }
            else {
                // Height not provided, calculate from data length
                height = data.length / 4 / width;
                opts = heightOrSettings;
            }
            if (!(data instanceof Uint8ClampedArray)) {
                throw new TypeError(`Failed to construct 'ImageData': parameter 1 is not of type 'Uint8ClampedArray'.`);
            }
            if (!Number.isInteger(width) || width <= 0) {
                throw new RangeError(`Failed to construct 'ImageData': The width is zero or not a number.`);
            }
            if (!Number.isInteger(height) || height <= 0) {
                throw new RangeError(`Failed to construct 'ImageData': The height is zero or not a number.`);
            }
            const expectedLength = width * height * 4;
            if (data.length !== expectedLength) {
                throw new RangeError(`Failed to construct 'ImageData': The input data byte length is not a multiple of (4 * width * height).`);
            }
            this.width = width;
            this.height = height;
            this.data = data;
            this.colorSpace = opts?.colorSpace ?? 'srgb';
        }
    }
}
// Register globally if ImageData is not already defined
if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = ImageData;
}
export default ImageData;
