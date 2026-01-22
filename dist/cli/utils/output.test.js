/**
 * Tests for output utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import { getOutputPath, writeOutputFile, ensureDir, makeUniquePath, replaceExtension, } from './output.js';
// Mock fs/promises
vi.mock('fs/promises', () => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
}));
describe('getOutputPath', () => {
    it('should return output path in same directory by default', () => {
        const inputPath = '/images/photo.jpg';
        const result = getOutputPath(inputPath, 'webp');
        expect(result).toBe(join('/images', 'photo.webp'));
    });
    it('should handle extension with leading dot', () => {
        const inputPath = '/images/photo.jpg';
        const result = getOutputPath(inputPath, '.webp');
        expect(result).toBe(join('/images', 'photo.webp'));
    });
    it('should use specified output directory', () => {
        const inputPath = '/images/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', { outputDir: '/output' });
        expect(result).toBe(join('/output', 'photo.webp'));
    });
    it('should add suffix before extension', () => {
        const inputPath = '/images/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', { suffix: '.min' });
        expect(result).toBe(join('/images', 'photo.min.webp'));
    });
    it('should preserve directory structure when requested', () => {
        const inputPath = '/images/vacation/beach/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', {
            outputDir: '/output',
            preserveStructure: true,
            inputBaseDir: '/images',
        });
        expect(result).toBe(join('/output', 'vacation', 'beach', 'photo.webp'));
    });
    it('should fall back to flat output when input outside base directory', () => {
        const inputPath = '/other/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', {
            outputDir: '/output',
            preserveStructure: true,
            inputBaseDir: '/images',
        });
        expect(result).toBe(join('/output', 'photo.webp'));
    });
    it('should combine suffix with output directory', () => {
        const inputPath = '/images/photo.png';
        const result = getOutputPath(inputPath, 'avif', {
            outputDir: '/compressed',
            suffix: '-compressed',
        });
        expect(result).toBe(join('/compressed', 'photo-compressed.avif'));
    });
});
describe('writeOutputFile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should write ArrayBuffer to file', async () => {
        const { mkdir, writeFile } = await import('fs/promises');
        const inputPath = join('/images', 'photo.jpg');
        const data = new ArrayBuffer(100);
        const result = await writeOutputFile(inputPath, data, 'webp');
        expect(mkdir).toHaveBeenCalledWith(join('/images'), { recursive: true });
        expect(writeFile).toHaveBeenCalled();
        expect(result).toBe(join('/images', 'photo.webp'));
    });
    it('should write Buffer to file', async () => {
        const { writeFile } = await import('fs/promises');
        const inputPath = join('/images', 'photo.jpg');
        const data = Buffer.from([1, 2, 3, 4]);
        const result = await writeOutputFile(inputPath, data, 'webp');
        expect(writeFile).toHaveBeenCalled();
        expect(result).toBe(join('/images', 'photo.webp'));
    });
});
describe('ensureDir', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should create directory recursively', async () => {
        const { mkdir } = await import('fs/promises');
        const testDir = join('/path', 'to', 'directory');
        await ensureDir(testDir);
        expect(mkdir).toHaveBeenCalledWith(testDir, { recursive: true });
    });
});
describe('makeUniquePath', () => {
    it('should return original path if not in set', () => {
        const existingPaths = new Set();
        const result = makeUniquePath('/images/photo.webp', existingPaths);
        expect(result).toBe('/images/photo.webp');
    });
    it('should add number suffix for collision', () => {
        const existingPaths = new Set(['/images/photo.webp']);
        const result = makeUniquePath('/images/photo.webp', existingPaths);
        expect(result).toBe(join('/images', 'photo_1.webp'));
    });
    it('should increment suffix for multiple collisions', () => {
        const existingPaths = new Set([
            '/images/photo.webp',
            join('/images', 'photo_1.webp'),
            join('/images', 'photo_2.webp'),
        ]);
        const result = makeUniquePath('/images/photo.webp', existingPaths);
        expect(result).toBe(join('/images', 'photo_3.webp'));
    });
});
describe('replaceExtension', () => {
    it('should replace file extension', () => {
        expect(replaceExtension('/images/photo.jpg', 'webp')).toBe('/images/photo.webp');
        expect(replaceExtension('/images/photo.png', '.avif')).toBe('/images/photo.avif');
    });
    it('should handle paths without extension', () => {
        expect(replaceExtension('/images/photo', 'webp')).toBe('/images/photo.webp');
    });
    it('should handle multiple dots in filename', () => {
        expect(replaceExtension('/images/photo.min.jpg', 'webp')).toBe('/images/photo.min.webp');
    });
});
// Additional edge case tests for getOutputPath
describe('getOutputPath - additional edge cases', () => {
    it('should handle empty extension', () => {
        const inputPath = '/images/photo.jpg';
        const result = getOutputPath(inputPath, '');
        expect(result).toBe(join('/images', 'photo.'));
    });
    it('should handle deeply nested paths', () => {
        const inputPath = '/a/b/c/d/e/f/photo.jpg';
        const result = getOutputPath(inputPath, 'webp');
        expect(result).toBe(join('/a/b/c/d/e/f', 'photo.webp'));
    });
    it('should handle hidden file (dotfile without extension)', () => {
        // Node's path.extname treats '.jpg' as a hidden file with no extension
        // extname('.jpg') returns '' (empty), so the full name is preserved and new ext is appended
        const inputPath = '/images/.jpg';
        const result = getOutputPath(inputPath, 'webp');
        expect(result).toBe(join('/images', '.jpg.webp'));
    });
    it('should handle paths with spaces', () => {
        const inputPath = '/my images/my photo.jpg';
        const result = getOutputPath(inputPath, 'webp');
        expect(result).toBe(join('/my images', 'my photo.webp'));
    });
    it('should handle paths with special characters', () => {
        const inputPath = '/images/photo (1) [copy].jpg';
        const result = getOutputPath(inputPath, 'webp');
        expect(result).toBe(join('/images', 'photo (1) [copy].webp'));
    });
    it('should handle unicode in paths', () => {
        const inputPath = '/画像/写真.jpg';
        const result = getOutputPath(inputPath, 'webp');
        expect(result).toBe(join('/画像', '写真.webp'));
    });
    it('should handle very long filenames', () => {
        const longName = 'a'.repeat(200);
        const inputPath = `/images/${longName}.jpg`;
        const result = getOutputPath(inputPath, 'webp');
        expect(result).toBe(join('/images', `${longName}.webp`));
    });
    it('should handle suffix with special characters', () => {
        const inputPath = '/images/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', { suffix: '_v2.0_final' });
        expect(result).toBe(join('/images', 'photo_v2.0_final.webp'));
    });
    it('should handle empty suffix', () => {
        const inputPath = '/images/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', { suffix: '' });
        expect(result).toBe(join('/images', 'photo.webp'));
    });
    it('should handle preserveStructure with same base and input directory', () => {
        const inputPath = '/images/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', {
            outputDir: '/output',
            preserveStructure: true,
            inputBaseDir: '/images',
        });
        expect(result).toBe(join('/output', 'photo.webp'));
    });
    it('should handle preserveStructure with deeply nested structure', () => {
        const inputPath = '/base/level1/level2/level3/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', {
            outputDir: '/output',
            preserveStructure: true,
            inputBaseDir: '/base',
        });
        expect(result).toBe(join('/output', 'level1', 'level2', 'level3', 'photo.webp'));
    });
    it('should handle preserveStructure without inputBaseDir', () => {
        const inputPath = '/images/vacation/photo.jpg';
        const result = getOutputPath(inputPath, 'webp', {
            outputDir: '/output',
            preserveStructure: true,
        });
        // Without inputBaseDir, should fall back to flat output
        expect(result).toBe(join('/output', 'photo.webp'));
    });
    it('should handle all options combined', () => {
        const inputPath = '/base/vacation/beach/photo.jpg';
        const result = getOutputPath(inputPath, 'avif', {
            outputDir: '/compressed',
            preserveStructure: true,
            inputBaseDir: '/base',
            suffix: '.optimized',
        });
        expect(result).toBe(join('/compressed', 'vacation', 'beach', 'photo.optimized.avif'));
    });
    it('should handle relative-looking paths in absolute form', () => {
        const inputPath = '/./images/photo.jpg';
        const result = getOutputPath(inputPath, 'webp');
        expect(result).toBe(join('/.', 'images', 'photo.webp'));
    });
});
// Additional edge case tests for writeOutputFile
describe('writeOutputFile - additional edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should handle empty ArrayBuffer', async () => {
        const { writeFile } = await import('fs/promises');
        const inputPath = join('/images', 'photo.jpg');
        const data = new ArrayBuffer(0);
        const result = await writeOutputFile(inputPath, data, 'webp');
        expect(writeFile).toHaveBeenCalled();
        expect(result).toBe(join('/images', 'photo.webp'));
    });
    it('should handle large ArrayBuffer', async () => {
        const { writeFile } = await import('fs/promises');
        const inputPath = join('/images', 'photo.jpg');
        const data = new ArrayBuffer(10 * 1024 * 1024); // 10 MB
        const result = await writeOutputFile(inputPath, data, 'webp');
        expect(writeFile).toHaveBeenCalled();
        expect(result).toBe(join('/images', 'photo.webp'));
    });
    it('should handle empty Buffer', async () => {
        const { writeFile } = await import('fs/promises');
        const inputPath = join('/images', 'photo.jpg');
        const data = Buffer.alloc(0);
        const result = await writeOutputFile(inputPath, data, 'webp');
        expect(writeFile).toHaveBeenCalled();
        expect(result).toBe(join('/images', 'photo.webp'));
    });
    it('should pass through options to getOutputPath', async () => {
        const { writeFile } = await import('fs/promises');
        const inputPath = join('/images', 'photo.jpg');
        const data = Buffer.from([1, 2, 3]);
        const result = await writeOutputFile(inputPath, data, 'webp', {
            outputDir: '/output',
            suffix: '.min',
        });
        expect(result).toBe(join('/output', 'photo.min.webp'));
    });
});
// Additional edge case tests for makeUniquePath
describe('makeUniquePath - additional edge cases', () => {
    it('should handle empty set', () => {
        const existingPaths = new Set();
        const result = makeUniquePath('/images/photo.webp', existingPaths);
        expect(result).toBe('/images/photo.webp');
    });
    it('should handle many collisions', () => {
        const existingPaths = new Set();
        for (let i = 0; i < 100; i++) {
            existingPaths.add(i === 0 ? '/images/photo.webp' : join('/images', `photo_${i}.webp`));
        }
        const result = makeUniquePath('/images/photo.webp', existingPaths);
        expect(result).toBe(join('/images', 'photo_100.webp'));
    });
    it('should handle path without extension', () => {
        const existingPaths = new Set(['/images/photo']);
        const result = makeUniquePath('/images/photo', existingPaths);
        expect(result).toBe(join('/images', 'photo_1'));
    });
    it('should handle hidden files', () => {
        const existingPaths = new Set(['/images/.hidden']);
        const result = makeUniquePath('/images/.hidden', existingPaths);
        expect(result).toBe(join('/images', '.hidden_1'));
    });
    it('should handle paths with spaces', () => {
        const existingPaths = new Set(['/my images/my photo.webp']);
        const result = makeUniquePath('/my images/my photo.webp', existingPaths);
        expect(result).toBe(join('/my images', 'my photo_1.webp'));
    });
    it('should handle filename that already has underscore number', () => {
        const existingPaths = new Set(['/images/photo_1.webp']);
        const result = makeUniquePath('/images/photo_1.webp', existingPaths);
        expect(result).toBe(join('/images', 'photo_1_1.webp'));
    });
    it('should handle root-level files', () => {
        const existingPaths = new Set(['/photo.webp']);
        const result = makeUniquePath('/photo.webp', existingPaths);
        expect(result).toBe(join('/', 'photo_1.webp'));
    });
});
// Additional edge case tests for replaceExtension
describe('replaceExtension - additional edge cases', () => {
    it('should handle empty new extension', () => {
        expect(replaceExtension('/images/photo.jpg', '')).toBe('/images/photo.');
    });
    it('should handle hidden file with extension', () => {
        expect(replaceExtension('/images/.gitignore.txt', 'md')).toBe('/images/.gitignore.md');
    });
    it('should handle dotfile (hidden file without extension)', () => {
        // Node's path.extname treats '.jpg' as a hidden file with no extension
        // So the full name is preserved and new ext is appended
        expect(replaceExtension('/images/.jpg', 'webp')).toBe('/images/.jpg.webp');
    });
    it('should handle paths with multiple consecutive dots', () => {
        expect(replaceExtension('/images/photo..jpg', 'webp')).toBe('/images/photo..webp');
    });
    it('should handle very long extensions', () => {
        const longExt = 'a'.repeat(50);
        expect(replaceExtension('/images/photo.jpg', longExt)).toBe(`/images/photo.${longExt}`);
    });
    it('should handle extension with numbers', () => {
        expect(replaceExtension('/images/photo.jpg', 'mp4')).toBe('/images/photo.mp4');
    });
    it('should handle same extension (no change needed)', () => {
        expect(replaceExtension('/images/photo.webp', 'webp')).toBe('/images/photo.webp');
    });
    it('should handle paths with unicode', () => {
        expect(replaceExtension('/画像/写真.jpg', 'webp')).toBe('/画像/写真.webp');
    });
});
// Additional edge case tests for ensureDir
describe('ensureDir - additional edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should handle deeply nested directory', async () => {
        const { mkdir } = await import('fs/promises');
        const deepPath = '/a/b/c/d/e/f/g/h/i/j';
        await ensureDir(deepPath);
        expect(mkdir).toHaveBeenCalledWith(deepPath, { recursive: true });
    });
    it('should handle directory with spaces', async () => {
        const { mkdir } = await import('fs/promises');
        const pathWithSpaces = '/my directory/sub folder';
        await ensureDir(pathWithSpaces);
        expect(mkdir).toHaveBeenCalledWith(pathWithSpaces, { recursive: true });
    });
    it('should handle unicode directory names', async () => {
        const { mkdir } = await import('fs/promises');
        const unicodePath = '/フォルダ/サブフォルダ';
        await ensureDir(unicodePath);
        expect(mkdir).toHaveBeenCalledWith(unicodePath, { recursive: true });
    });
    it('should handle root directory', async () => {
        const { mkdir } = await import('fs/promises');
        await ensureDir('/');
        expect(mkdir).toHaveBeenCalledWith('/', { recursive: true });
    });
});
