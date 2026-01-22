/**
 * Tests for ImageData polyfill
 */

import { describe, it, expect } from 'vitest';
import { ImageData as PolyfillImageData } from './image-data.js';

describe('ImageData polyfill', () => {
  describe('constructor with width and height', () => {
    it('should create ImageData with specified dimensions', () => {
      const imageData = new PolyfillImageData(100, 50);

      expect(imageData.width).toBe(100);
      expect(imageData.height).toBe(50);
      expect(imageData.data).toBeInstanceOf(Uint8ClampedArray);
      expect(imageData.data.length).toBe(100 * 50 * 4);
      expect(imageData.colorSpace).toBe('srgb');
    });

    it('should create ImageData with custom colorSpace', () => {
      const imageData = new PolyfillImageData(10, 10, { colorSpace: 'display-p3' });

      expect(imageData.colorSpace).toBe('display-p3');
    });

    it('should throw RangeError for zero width', () => {
      expect(() => new PolyfillImageData(0, 10)).toThrow(RangeError);
      expect(() => new PolyfillImageData(0, 10)).toThrow(
        "Failed to construct 'ImageData': The width is zero or not a number."
      );
    });

    it('should throw RangeError for zero height', () => {
      expect(() => new PolyfillImageData(10, 0)).toThrow(RangeError);
      expect(() => new PolyfillImageData(10, 0)).toThrow(
        "Failed to construct 'ImageData': The height is zero or not a number."
      );
    });

    it('should throw RangeError for negative width', () => {
      expect(() => new PolyfillImageData(-5, 10)).toThrow(RangeError);
    });

    it('should throw RangeError for negative height', () => {
      expect(() => new PolyfillImageData(10, -5)).toThrow(RangeError);
    });

    it('should throw RangeError for non-integer width', () => {
      expect(() => new PolyfillImageData(10.5, 10)).toThrow(RangeError);
    });

    it('should throw RangeError for non-integer height', () => {
      expect(() => new PolyfillImageData(10, 10.5)).toThrow(RangeError);
    });
  });

  describe('constructor with data', () => {
    it('should create ImageData from Uint8ClampedArray with explicit height', () => {
      const data = new Uint8ClampedArray(40); // 2x5 pixels
      const imageData = new PolyfillImageData(data, 2, 5);

      expect(imageData.width).toBe(2);
      expect(imageData.height).toBe(5);
      expect(imageData.data).toBe(data);
      expect(imageData.colorSpace).toBe('srgb');
    });

    it('should create ImageData from Uint8ClampedArray with inferred height', () => {
      const data = new Uint8ClampedArray(80); // 4x5 pixels
      const imageData = new PolyfillImageData(data, 4);

      expect(imageData.width).toBe(4);
      expect(imageData.height).toBe(5);
      expect(imageData.data).toBe(data);
    });

    it('should create ImageData with custom colorSpace from data', () => {
      const data = new Uint8ClampedArray(16); // 2x2 pixels
      const imageData = new PolyfillImageData(data, 2, 2, { colorSpace: 'display-p3' });

      expect(imageData.colorSpace).toBe('display-p3');
    });

    it('should throw TypeError for non-Uint8ClampedArray data', () => {
      const data = new Uint8Array(40);
      expect(() => new PolyfillImageData(data as unknown as Uint8ClampedArray, 2, 5)).toThrow(TypeError);
      expect(() => new PolyfillImageData(data as unknown as Uint8ClampedArray, 2, 5)).toThrow(
        "Failed to construct 'ImageData': parameter 1 is not of type 'Uint8ClampedArray'."
      );
    });

    it('should throw RangeError for data length mismatch', () => {
      const data = new Uint8ClampedArray(40); // 2x5 pixels
      expect(() => new PolyfillImageData(data, 3, 5)).toThrow(RangeError);
      expect(() => new PolyfillImageData(data, 3, 5)).toThrow(
        "Failed to construct 'ImageData': The input data byte length is not a multiple of (4 * width * height)."
      );
    });

    it('should throw RangeError for zero width with data', () => {
      const data = new Uint8ClampedArray(40);
      expect(() => new PolyfillImageData(data, 0, 10)).toThrow(RangeError);
    });

    it('should throw RangeError for zero height with data', () => {
      const data = new Uint8ClampedArray(40);
      expect(() => new PolyfillImageData(data, 2, 0)).toThrow(RangeError);
    });
  });

  describe('data property', () => {
    it('should return readonly data array', () => {
      const imageData = new PolyfillImageData(2, 2);

      // Data should be modifiable through the array
      imageData.data[0] = 255;
      expect(imageData.data[0]).toBe(255);
    });

    it('should initialize data with zeros for width/height constructor', () => {
      const imageData = new PolyfillImageData(2, 2);

      const allZeros = imageData.data.every(v => v === 0);
      expect(allZeros).toBe(true);
    });
  });
});
