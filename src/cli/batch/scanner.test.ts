/**
 * Tests for file scanner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseExtensions, DEFAULT_EXTENSIONS, scanFiles } from './scanner.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
}));

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

describe('parseExtensions', () => {
  it('should parse comma-separated extensions', () => {
    expect(parseExtensions('jpg,png,webp')).toEqual(['jpg', 'png', 'webp']);
  });

  it('should handle extensions with leading dots', () => {
    expect(parseExtensions('.jpg,.png,.webp')).toEqual(['jpg', 'png', 'webp']);
  });

  it('should trim whitespace', () => {
    expect(parseExtensions('jpg , png , webp')).toEqual(['jpg', 'png', 'webp']);
  });

  it('should convert to lowercase', () => {
    expect(parseExtensions('JPG,PNG,WEBP')).toEqual(['jpg', 'png', 'webp']);
  });

  it('should handle mixed formats', () => {
    expect(parseExtensions('.JPG, png,  .WEBP')).toEqual(['jpg', 'png', 'webp']);
  });

  it('should parse single extension', () => {
    expect(parseExtensions('jpg')).toEqual(['jpg']);
  });
});

describe('DEFAULT_EXTENSIONS', () => {
  it('should include common image formats', () => {
    expect(DEFAULT_EXTENSIONS).toContain('jpg');
    expect(DEFAULT_EXTENSIONS).toContain('jpeg');
    expect(DEFAULT_EXTENSIONS).toContain('png');
    expect(DEFAULT_EXTENSIONS).toContain('webp');
    expect(DEFAULT_EXTENSIONS).toContain('avif');
    expect(DEFAULT_EXTENSIONS).toContain('jxl');
    expect(DEFAULT_EXTENSIONS).toContain('qoi');
    expect(DEFAULT_EXTENSIONS).toContain('wp2');
  });
});

describe('scanFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return single file if extension is allowed', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    const result = await scanFiles('/images/photo.jpg', {
      extensions: ['jpg', 'png'],
      recursive: false,
    });

    expect(result).toEqual(['/images/photo.jpg']);
  });

  it('should throw error if file extension not allowed', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    await expect(
      scanFiles('/images/photo.gif', {
        extensions: ['jpg', 'png'],
        recursive: false,
      })
    ).rejects.toThrow('File extension .gif not in allowed list: jpg, png');
  });

  it('should scan directory with glob', async () => {
    const { stat } = await import('node:fs/promises');
    const { glob } = await import('glob');

    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => false,
      isDirectory: () => true,
    });
    (glob as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      '/images/photo1.jpg',
      '/images/photo2.png',
    ]);

    const result = await scanFiles('/images', {
      extensions: ['jpg', 'png'],
      recursive: false,
    });

    expect(glob).toHaveBeenCalledWith(
      '*.{jpg,png}',
      expect.objectContaining({
        cwd: '/images',
        absolute: true,
        nocase: true,
      })
    );
    expect(result).toEqual(['/images/photo1.jpg', '/images/photo2.png']);
  });

  it('should scan directory recursively', async () => {
    const { stat } = await import('node:fs/promises');
    const { glob } = await import('glob');

    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => false,
      isDirectory: () => true,
    });
    (glob as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await scanFiles('/images', {
      extensions: ['jpg', 'png'],
      recursive: true,
    });

    expect(glob).toHaveBeenCalledWith(
      '**/*.{jpg,png}',
      expect.anything()
    );
  });

  it('should handle single extension without braces', async () => {
    const { stat } = await import('node:fs/promises');
    const { glob } = await import('glob');

    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => false,
      isDirectory: () => true,
    });
    (glob as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await scanFiles('/images', {
      extensions: ['png'],
      recursive: false,
    });

    expect(glob).toHaveBeenCalledWith(
      '*.png',
      expect.anything()
    );
  });

  it('should throw error for invalid input', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => false,
      isDirectory: () => false,
    });

    await expect(
      scanFiles('/images/unknown', {
        extensions: ['jpg'],
        recursive: false,
      })
    ).rejects.toThrow('Input must be a file or directory');
  });

  // Additional edge case tests
  it('should handle case-insensitive extension matching for files', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    // File with uppercase extension should match lowercase in allowed list
    const result = await scanFiles('/images/photo.JPG', {
      extensions: ['jpg', 'png'],
      recursive: false,
    });

    expect(result).toEqual(['/images/photo.JPG']);
  });

  it('should reject file with extension not in list (case insensitive)', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    await expect(
      scanFiles('/images/photo.BMP', {
        extensions: ['jpg', 'png'],
        recursive: false,
      })
    ).rejects.toThrow('File extension .bmp not in allowed list');
  });

  it('should handle file without extension', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    await expect(
      scanFiles('/images/photo', {
        extensions: ['jpg', 'png'],
        recursive: false,
      })
    ).rejects.toThrow('File extension . not in allowed list');
  });

  it('should handle file with multiple dots in name', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    const result = await scanFiles('/images/photo.min.backup.jpg', {
      extensions: ['jpg', 'png'],
      recursive: false,
    });

    expect(result).toEqual(['/images/photo.min.backup.jpg']);
  });

  it('should handle hidden files (dotfiles)', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    const result = await scanFiles('/images/.hidden.jpg', {
      extensions: ['jpg', 'png'],
      recursive: false,
    });

    expect(result).toEqual(['/images/.hidden.jpg']);
  });

  it('should handle empty directory (no matching files)', async () => {
    const { stat } = await import('node:fs/promises');
    const { glob } = await import('glob');

    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => false,
      isDirectory: () => true,
    });
    (glob as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await scanFiles('/empty-dir', {
      extensions: ['jpg', 'png'],
      recursive: false,
    });

    expect(result).toEqual([]);
  });

  it('should handle directory with many extensions', async () => {
    const { stat } = await import('node:fs/promises');
    const { glob } = await import('glob');

    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => false,
      isDirectory: () => true,
    });
    (glob as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await scanFiles('/images', {
      extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'jxl', 'qoi', 'wp2'],
      recursive: false,
    });

    expect(glob).toHaveBeenCalledWith(
      '*.{jpg,jpeg,png,webp,avif,jxl,qoi,wp2}',
      expect.anything()
    );
  });

  it('should handle paths with spaces', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    const result = await scanFiles('/my images/vacation photo.jpg', {
      extensions: ['jpg'],
      recursive: false,
    });

    expect(result).toEqual(['/my images/vacation photo.jpg']);
  });

  it('should handle paths with special characters', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    const result = await scanFiles('/images/photo (1) [copy].jpg', {
      extensions: ['jpg'],
      recursive: false,
    });

    expect(result).toEqual(['/images/photo (1) [copy].jpg']);
  });

  it('should handle unicode filenames', async () => {
    const { stat } = await import('node:fs/promises');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    const result = await scanFiles('/images/foto-日本語.jpg', {
      extensions: ['jpg'],
      recursive: false,
    });

    expect(result).toEqual(['/images/foto-日本語.jpg']);
  });

  it('should handle stat throwing ENOENT error', async () => {
    const { stat } = await import('node:fs/promises');
    const error = new Error('ENOENT: no such file or directory');
    (error as NodeJS.ErrnoException).code = 'ENOENT';
    (stat as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    await expect(
      scanFiles('/nonexistent/path.jpg', {
        extensions: ['jpg'],
        recursive: false,
      })
    ).rejects.toThrow('ENOENT');
  });

  it('should handle stat throwing EACCES error', async () => {
    const { stat } = await import('node:fs/promises');
    const error = new Error('EACCES: permission denied');
    (error as NodeJS.ErrnoException).code = 'EACCES';
    (stat as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    await expect(
      scanFiles('/protected/path.jpg', {
        extensions: ['jpg'],
        recursive: false,
      })
    ).rejects.toThrow('EACCES');
  });
});

describe('parseExtensions - additional edge cases', () => {
  it('should handle empty string', () => {
    expect(parseExtensions('')).toEqual(['']);
  });

  it('should handle single dot', () => {
    expect(parseExtensions('.')).toEqual(['']);
  });

  it('should handle multiple consecutive commas', () => {
    expect(parseExtensions('jpg,,png')).toEqual(['jpg', '', 'png']);
  });

  it('should handle leading comma', () => {
    expect(parseExtensions(',jpg,png')).toEqual(['', 'jpg', 'png']);
  });

  it('should handle trailing comma', () => {
    expect(parseExtensions('jpg,png,')).toEqual(['jpg', 'png', '']);
  });

  it('should handle only whitespace between commas', () => {
    expect(parseExtensions('jpg,   ,png')).toEqual(['jpg', '', 'png']);
  });

  it('should handle tabs and newlines', () => {
    expect(parseExtensions('jpg,\tpng,\nwebp')).toEqual(['jpg', 'png', 'webp']);
  });

  it('should handle extension with numbers', () => {
    expect(parseExtensions('mp4,3gp,m4a')).toEqual(['mp4', '3gp', 'm4a']);
  });

  it('should handle very long extension list', () => {
    const longList = new Array(100).fill('jpg').join(',');
    const result = parseExtensions(longList);
    expect(result).toHaveLength(100);
    expect(result.every(e => e === 'jpg')).toBe(true);
  });

  it('should handle mixed dots in extension list', () => {
    expect(parseExtensions('jpg,.png,webp,.avif')).toEqual(['jpg', 'png', 'webp', 'avif']);
  });

  it('should handle double dots', () => {
    expect(parseExtensions('..jpg')).toEqual(['.jpg']);
  });
});

describe('DEFAULT_EXTENSIONS - additional tests', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(DEFAULT_EXTENSIONS)).toBe(true);
    expect(DEFAULT_EXTENSIONS.length).toBeGreaterThan(0);
  });

  it('should contain only lowercase extensions', () => {
    DEFAULT_EXTENSIONS.forEach(ext => {
      expect(ext).toBe(ext.toLowerCase());
    });
  });

  it('should contain only extensions without dots', () => {
    DEFAULT_EXTENSIONS.forEach(ext => {
      expect(ext.startsWith('.')).toBe(false);
    });
  });

  it('should not contain duplicates', () => {
    const uniqueExtensions = new Set(DEFAULT_EXTENSIONS);
    expect(uniqueExtensions.size).toBe(DEFAULT_EXTENSIONS.length);
  });

  it('should have both jpg and jpeg', () => {
    expect(DEFAULT_EXTENSIONS).toContain('jpg');
    expect(DEFAULT_EXTENSIONS).toContain('jpeg');
  });
});
