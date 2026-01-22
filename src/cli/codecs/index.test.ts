/**
 * Tests for codec registry
 * Note: These tests mock the encoder modules to avoid loading WASM
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all encoder modules before importing the main module
vi.mock('./encoders/mozjpeg.js', () => ({
  label: 'MozJPEG',
  mimeType: 'image/jpeg',
  extension: 'jpg',
  defaultOptions: { quality: 75 },
  encode: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  warmup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./encoders/avif.js', () => ({
  label: 'AVIF',
  mimeType: 'image/avif',
  extension: 'avif',
  defaultOptions: { quality: 50 },
  encode: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  warmup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./encoders/webp.js', () => ({
  label: 'WebP',
  mimeType: 'image/webp',
  extension: 'webp',
  defaultOptions: { quality: 75 },
  encode: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  warmup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./encoders/jxl.js', () => ({
  label: 'JPEG XL',
  mimeType: 'image/jxl',
  extension: 'jxl',
  defaultOptions: { quality: 75 },
  encode: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  warmup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./encoders/oxipng.js', () => ({
  label: 'OxiPNG',
  mimeType: 'image/png',
  extension: 'png',
  defaultOptions: { level: 2 },
  encode: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  warmup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./encoders/qoi.js', () => ({
  label: 'QOI',
  mimeType: 'image/qoi',
  extension: 'qoi',
  defaultOptions: {},
  encode: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  warmup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./encoders/wp2.js', () => ({
  label: 'WebP2',
  mimeType: 'image/webp2',
  extension: 'wp2',
  defaultOptions: { quality: 75 },
  encode: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  warmup: vi.fn().mockResolvedValue(undefined),
  UVMode: { UVModeAdapt: 0 },
  Csp: { kYCoCg: 0 },
}));

describe('codec registry', () => {
  let codecs: typeof import('./index.js');

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to reset state
    codecs = await import('./index.js');
  });

  describe('encoders', () => {
    it('should have all expected encoders registered', () => {
      expect(codecs.encoders).toHaveProperty('mozjpeg');
      expect(codecs.encoders).toHaveProperty('avif');
      expect(codecs.encoders).toHaveProperty('webp');
      expect(codecs.encoders).toHaveProperty('jxl');
      expect(codecs.encoders).toHaveProperty('oxipng');
      expect(codecs.encoders).toHaveProperty('qoi');
      expect(codecs.encoders).toHaveProperty('wp2');
    });

    it('should have correct codec info structure', () => {
      const mozjpeg = codecs.encoders.mozjpeg;

      expect(mozjpeg.name).toBe('mozjpeg');
      expect(mozjpeg.label).toBe('MozJPEG');
      expect(mozjpeg.mimeType).toBe('image/jpeg');
      expect(mozjpeg.extension).toBe('jpg');
      expect(mozjpeg.defaultOptions).toEqual({ quality: 75 });
      expect(typeof mozjpeg.encode).toBe('function');
    });
  });

  describe('getEncoder', () => {
    it('should return encoder by name', () => {
      const encoder = codecs.getEncoder('mozjpeg');

      expect(encoder).toBeDefined();
      expect(encoder?.name).toBe('mozjpeg');
    });

    it('should return undefined for unknown encoder', () => {
      const encoder = codecs.getEncoder('unknown');

      expect(encoder).toBeUndefined();
    });
  });

  describe('listEncoders', () => {
    it('should return all encoder names', () => {
      const names = codecs.listEncoders();

      expect(names).toContain('mozjpeg');
      expect(names).toContain('avif');
      expect(names).toContain('webp');
      expect(names).toContain('jxl');
      expect(names).toContain('oxipng');
      expect(names).toContain('qoi');
      expect(names).toContain('wp2');
      expect(names).toHaveLength(7);
    });
  });

  describe('getAllEncoders', () => {
    it('should return all encoder info objects', () => {
      const encoders = codecs.getAllEncoders();

      expect(encoders).toHaveLength(7);
      expect(encoders.every(e => e.name && e.label && e.encode)).toBe(true);
    });
  });

  describe('getEncoderByExtension', () => {
    it('should find encoder by extension without dot', () => {
      const encoder = codecs.getEncoderByExtension('webp');

      expect(encoder).toBeDefined();
      expect(encoder?.name).toBe('webp');
    });

    it('should find encoder by extension with dot', () => {
      const encoder = codecs.getEncoderByExtension('.avif');

      expect(encoder).toBeDefined();
      expect(encoder?.name).toBe('avif');
    });

    it('should return undefined for unknown extension', () => {
      const encoder = codecs.getEncoderByExtension('gif');

      expect(encoder).toBeUndefined();
    });
  });

  describe('getEncoderByMimeType', () => {
    it('should find encoder by MIME type', () => {
      const encoder = codecs.getEncoderByMimeType('image/webp');

      expect(encoder).toBeDefined();
      expect(encoder?.name).toBe('webp');
    });

    it('should return undefined for unknown MIME type', () => {
      const encoder = codecs.getEncoderByMimeType('image/gif');

      expect(encoder).toBeUndefined();
    });
  });

  // Additional edge case tests
  describe('getEncoder - edge cases', () => {
    it('should return undefined for empty string', () => {
      const encoder = codecs.getEncoder('');
      expect(encoder).toBeUndefined();
    });

    it('should be case-sensitive (uppercase name returns undefined)', () => {
      const encoder = codecs.getEncoder('MOZJPEG');
      expect(encoder).toBeUndefined();
    });

    it('should be case-sensitive (mixed case name returns undefined)', () => {
      const encoder = codecs.getEncoder('MozJpeg');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for name with whitespace', () => {
      const encoder = codecs.getEncoder(' mozjpeg');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for name with trailing whitespace', () => {
      const encoder = codecs.getEncoder('mozjpeg ');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for name with special characters', () => {
      const encoder = codecs.getEncoder('moz-jpeg');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for numeric string', () => {
      const encoder = codecs.getEncoder('123');
      expect(encoder).toBeUndefined();
    });

    it('should return all different encoders by their names', () => {
      const names = ['mozjpeg', 'avif', 'webp', 'jxl', 'oxipng', 'qoi', 'wp2'];
      names.forEach(name => {
        const encoder = codecs.getEncoder(name);
        expect(encoder).toBeDefined();
        expect(encoder?.name).toBe(name);
      });
    });
  });

  describe('getEncoderByExtension - edge cases', () => {
    it('should return undefined for empty string', () => {
      const encoder = codecs.getEncoderByExtension('');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for just a dot', () => {
      const encoder = codecs.getEncoderByExtension('.');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for multiple dots', () => {
      const encoder = codecs.getEncoderByExtension('..webp');
      expect(encoder).toBeUndefined();
    });

    it('should handle uppercase extension', () => {
      // Note: current implementation is case-sensitive
      const encoder = codecs.getEncoderByExtension('WEBP');
      expect(encoder).toBeUndefined(); // uppercase not normalized
    });

    it('should handle uppercase extension with dot', () => {
      const encoder = codecs.getEncoderByExtension('.WEBP');
      expect(encoder).toBeUndefined(); // uppercase not normalized
    });

    it('should return undefined for extension with spaces', () => {
      const encoder = codecs.getEncoderByExtension(' webp');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for similar but wrong extension', () => {
      const encoder = codecs.getEncoderByExtension('jpeg'); // mozjpeg uses 'jpg'
      expect(encoder).toBeUndefined();
    });

    it('should find all encoders by their correct extensions', () => {
      const extensionToName: Record<string, string> = {
        'jpg': 'mozjpeg',
        'avif': 'avif',
        'webp': 'webp',
        'jxl': 'jxl',
        'png': 'oxipng',
        'qoi': 'qoi',
        'wp2': 'wp2',
      };

      Object.entries(extensionToName).forEach(([ext, name]) => {
        const encoder = codecs.getEncoderByExtension(ext);
        expect(encoder).toBeDefined();
        expect(encoder?.name).toBe(name);
      });
    });

    it('should find all encoders by extensions with dot prefix', () => {
      const extensionToName: Record<string, string> = {
        '.jpg': 'mozjpeg',
        '.avif': 'avif',
        '.webp': 'webp',
        '.jxl': 'jxl',
        '.png': 'oxipng',
        '.qoi': 'qoi',
        '.wp2': 'wp2',
      };

      Object.entries(extensionToName).forEach(([ext, name]) => {
        const encoder = codecs.getEncoderByExtension(ext);
        expect(encoder).toBeDefined();
        expect(encoder?.name).toBe(name);
      });
    });
  });

  describe('getEncoderByMimeType - edge cases', () => {
    it('should return undefined for empty string', () => {
      const encoder = codecs.getEncoderByMimeType('');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for malformed MIME type', () => {
      const encoder = codecs.getEncoderByMimeType('webp');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for MIME type with wrong prefix', () => {
      const encoder = codecs.getEncoderByMimeType('video/webp');
      expect(encoder).toBeUndefined();
    });

    it('should be case-sensitive for MIME type', () => {
      const encoder = codecs.getEncoderByMimeType('IMAGE/WEBP');
      expect(encoder).toBeUndefined();
    });

    it('should return undefined for MIME type with whitespace', () => {
      const encoder = codecs.getEncoderByMimeType(' image/webp');
      expect(encoder).toBeUndefined();
    });

    it('should find all encoders by their MIME types', () => {
      const mimeToName: Record<string, string> = {
        'image/jpeg': 'mozjpeg',
        'image/avif': 'avif',
        'image/webp': 'webp',
        'image/jxl': 'jxl',
        'image/png': 'oxipng',
        'image/qoi': 'qoi',
        'image/webp2': 'wp2',
      };

      Object.entries(mimeToName).forEach(([mime, name]) => {
        const encoder = codecs.getEncoderByMimeType(mime);
        expect(encoder).toBeDefined();
        expect(encoder?.name).toBe(name);
      });
    });
  });

  describe('listEncoders - edge cases', () => {
    it('should return an array', () => {
      const names = codecs.listEncoders();
      expect(Array.isArray(names)).toBe(true);
    });

    it('should not return duplicates', () => {
      const names = codecs.listEncoders();
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should return only string values', () => {
      const names = codecs.listEncoders();
      names.forEach(name => {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getAllEncoders - edge cases', () => {
    it('should return an array', () => {
      const encoders = codecs.getAllEncoders();
      expect(Array.isArray(encoders)).toBe(true);
    });

    it('should return objects with required properties', () => {
      const encoders = codecs.getAllEncoders();
      encoders.forEach(encoder => {
        expect(encoder).toHaveProperty('name');
        expect(encoder).toHaveProperty('label');
        expect(encoder).toHaveProperty('mimeType');
        expect(encoder).toHaveProperty('extension');
        expect(encoder).toHaveProperty('defaultOptions');
        expect(encoder).toHaveProperty('encode');
      });
    });

    it('should return encoders with non-empty string properties', () => {
      const encoders = codecs.getAllEncoders();
      encoders.forEach(encoder => {
        expect(typeof encoder.name).toBe('string');
        expect(encoder.name.length).toBeGreaterThan(0);
        expect(typeof encoder.label).toBe('string');
        expect(encoder.label.length).toBeGreaterThan(0);
        expect(typeof encoder.mimeType).toBe('string');
        expect(encoder.mimeType.length).toBeGreaterThan(0);
        expect(typeof encoder.extension).toBe('string');
        expect(encoder.extension.length).toBeGreaterThan(0);
      });
    });

    it('should return encoders with callable encode functions', () => {
      const encoders = codecs.getAllEncoders();
      encoders.forEach(encoder => {
        expect(typeof encoder.encode).toBe('function');
      });
    });

    it('should have unique names across all encoders', () => {
      const encoders = codecs.getAllEncoders();
      const names = encoders.map(e => e.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(encoders.length);
    });

    it('should have unique extensions across all encoders', () => {
      const encoders = codecs.getAllEncoders();
      const extensions = encoders.map(e => e.extension);
      const uniqueExtensions = new Set(extensions);
      expect(uniqueExtensions.size).toBe(encoders.length);
    });
  });

  describe('encoders registry - edge cases', () => {
    it('should have immutable structure (names match keys)', () => {
      Object.entries(codecs.encoders).forEach(([key, encoder]) => {
        expect(encoder.name).toBe(key);
      });
    });

    it('should have valid defaultOptions objects', () => {
      Object.values(codecs.encoders).forEach(encoder => {
        expect(encoder.defaultOptions).toBeDefined();
        expect(typeof encoder.defaultOptions).toBe('object');
      });
    });

    it('should have MIME types starting with image/', () => {
      Object.values(codecs.encoders).forEach(encoder => {
        expect(encoder.mimeType.startsWith('image/')).toBe(true);
      });
    });

    it('should have extensions without leading dots', () => {
      Object.values(codecs.encoders).forEach(encoder => {
        expect(encoder.extension.startsWith('.')).toBe(false);
      });
    });
  });
});
