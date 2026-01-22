/**
 * Polyfills for Node.js CLI
 * Must be imported before any codec code runs
 *
 * This provides:
 * - Browser-compatible ImageData implementation
 * - __dirname and __filename globals for ESM compatibility with Emscripten modules
 */

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

// Polyfill __filename and __dirname for ESM compatibility
// These are needed by Emscripten-generated modules that expect CommonJS globals
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const g = globalThis as Record<string, unknown>;

if (g.__filename === undefined) {
  g.__filename = __filename;
}
if (g.__dirname === undefined) {
  g.__dirname = __dirname;
}

// Also provide a require function for modules that need it
if (g.require === undefined) {
  g.require = createRequire(import.meta.url);
}

export interface ImageDataSettings {
  colorSpace?: PredefinedColorSpace;
}

export type PredefinedColorSpace = 'srgb' | 'display-p3';

export class ImageData {
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
  constructor(
    data: Uint8ClampedArray,
    sw: number,
    sh?: number,
    settings?: ImageDataSettings,
  );
  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight: number,
    heightOrSettings?: number | ImageDataSettings,
    settings?: ImageDataSettings,
  ) {
    if (typeof dataOrWidth === 'number') {
      // Constructor: new ImageData(width, height, settings?)
      const width = dataOrWidth;
      const height = widthOrHeight;
      const opts =
        typeof heightOrSettings === 'object' ? heightOrSettings : undefined;

      if (!Number.isInteger(width) || width <= 0) {
        throw new RangeError(
          `Failed to construct 'ImageData': The width is zero or not a number.`,
        );
      }
      if (!Number.isInteger(height) || height <= 0) {
        throw new RangeError(
          `Failed to construct 'ImageData': The height is zero or not a number.`,
        );
      }

      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
      this.colorSpace = opts?.colorSpace ?? 'srgb';
    } else {
      // Constructor: new ImageData(data, width, height?, settings?)
      const data = dataOrWidth;
      const width = widthOrHeight;
      let height: number;
      let opts: ImageDataSettings | undefined;

      if (typeof heightOrSettings === 'number') {
        height = heightOrSettings;
        opts = settings;
      } else {
        // Height not provided, calculate from data length
        height = data.length / 4 / width;
        opts = heightOrSettings;
      }

      if (!(data instanceof Uint8ClampedArray)) {
        throw new TypeError(
          `Failed to construct 'ImageData': parameter 1 is not of type 'Uint8ClampedArray'.`,
        );
      }
      if (!Number.isInteger(width) || width <= 0) {
        throw new RangeError(
          `Failed to construct 'ImageData': The width is zero or not a number.`,
        );
      }
      if (!Number.isInteger(height) || height <= 0) {
        throw new RangeError(
          `Failed to construct 'ImageData': The height is zero or not a number.`,
        );
      }

      const expectedLength = width * height * 4;
      if (data.length !== expectedLength) {
        throw new RangeError(
          `Failed to construct 'ImageData': The input data byte length is not a multiple of (4 * width * height).`,
        );
      }

      this.width = width;
      this.height = height;
      this.data = data;
      this.colorSpace = opts?.colorSpace ?? 'srgb';
    }
  }
}

// Register globally if ImageData is not already defined
if (globalThis.ImageData === undefined) {
  (globalThis as Record<string, unknown>).ImageData = ImageData;
}

export default ImageData;
