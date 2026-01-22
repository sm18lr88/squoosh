/**
 * Tests for decoder registry
 */
import { describe, it, expect, vi } from 'vitest';
import { getSupportedExtensions, isFormatSupported, } from './index.js';
// Mock all decoder modules to avoid loading WASM
vi.mock('./avif.js', () => ({
    decode: vi.fn().mockResolvedValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
vi.mock('./webp.js', () => ({
    decode: vi.fn().mockResolvedValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
vi.mock('./jxl.js', () => ({
    decode: vi.fn().mockResolvedValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
vi.mock('./qoi.js', () => ({
    decode: vi.fn().mockResolvedValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
vi.mock('./wp2.js', () => ({
    decode: vi.fn().mockResolvedValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
vi.mock('./jpeg.js', () => ({
    decode: vi.fn().mockResolvedValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
vi.mock('./png.js', () => ({
    decode: vi.fn().mockResolvedValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
describe('decoder registry', () => {
    describe('getSupportedExtensions', () => {
        it('should return all supported extensions with dots', () => {
            const extensions = getSupportedExtensions();
            expect(extensions).toContain('.jpg');
            expect(extensions).toContain('.jpeg');
            expect(extensions).toContain('.png');
            expect(extensions).toContain('.webp');
            expect(extensions).toContain('.avif');
            expect(extensions).toContain('.jxl');
            expect(extensions).toContain('.qoi');
            expect(extensions).toContain('.wp2');
        });
        it('should return 8 supported formats', () => {
            const extensions = getSupportedExtensions();
            expect(extensions).toHaveLength(8);
        });
    });
    describe('isFormatSupported', () => {
        it('should return true for supported formats with dot', () => {
            expect(isFormatSupported('.jpg')).toBe(true);
            expect(isFormatSupported('.png')).toBe(true);
            expect(isFormatSupported('.webp')).toBe(true);
        });
        it('should return true for supported formats without dot', () => {
            expect(isFormatSupported('jpg')).toBe(true);
            expect(isFormatSupported('png')).toBe(true);
            expect(isFormatSupported('webp')).toBe(true);
        });
        it('should handle uppercase extensions', () => {
            expect(isFormatSupported('.JPG')).toBe(true);
            expect(isFormatSupported('PNG')).toBe(true);
        });
        it('should return false for unsupported formats', () => {
            expect(isFormatSupported('.gif')).toBe(false);
            expect(isFormatSupported('.bmp')).toBe(false);
            expect(isFormatSupported('tiff')).toBe(false);
        });
        it('should handle jpeg alias', () => {
            expect(isFormatSupported('.jpeg')).toBe(true);
            expect(isFormatSupported('jpeg')).toBe(true);
        });
    });
});
