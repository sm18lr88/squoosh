/**
 * Squoosh CLI Integration Tests
 *
 * These tests run actual CLI commands and compression operations against real images.
 * They verify end-to-end functionality including file I/O and image encoding.
 *
 * Note: These tests require Sharp to be available and may take longer than unit tests.
 * They are skipped in environments where Sharp/WASM is not available.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdir, rm, readFile, writeFile, stat, readdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FIXTURES } from '../test-fixtures/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Path to the CLI entry point (compiled)
const CLI_PATH = path.resolve(__dirname, '../../dist/cli/index.js');
// Fallback to source if dist doesn't exist (for ts-node/vitest)
const CLI_SOURCE_PATH = path.resolve(__dirname, './index.ts');
// Temp directory for test outputs
const TEMP_DIR = path.join(__dirname, '__integration_test_temp__');
const BATCH_DIR = path.join(TEMP_DIR, 'batch');
/**
 * Check if Sharp is available for testing
 */
function isSharpAvailable() {
    try {
        // Try to import sharp dynamically
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('sharp');
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if the CLI is built and available
 */
function isCliBuildAvailable() {
    return existsSync(CLI_PATH);
}
/**
 * Run the Squoosh CLI with given arguments
 * @param args - CLI arguments
 * @param options - Additional spawn options
 * @returns Object with stdout, stderr, and exit code
 */
function runCli(args, options = {}) {
    const cliPath = isCliBuildAvailable() ? CLI_PATH : CLI_SOURCE_PATH;
    const useTs = !isCliBuildAvailable();
    const spawnArgs = useTs
        ? ['--import', 'tsx', cliPath, ...args]
        : [cliPath, ...args];
    const result = spawnSync('node', spawnArgs, {
        cwd: options.cwd || TEMP_DIR,
        timeout: options.timeout || 120000, // 2 minutes default
        encoding: 'utf-8',
        env: {
            ...process.env,
            // Force color off for consistent output parsing
            FORCE_COLOR: '0',
            NO_COLOR: '1',
        },
    });
    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.status,
    };
}
/**
 * Read file size in bytes
 */
async function getFileSize(filePath) {
    const stats = await stat(filePath);
    return stats.size;
}
/**
 * Check if a file is a valid image by checking magic bytes
 */
async function isValidImage(filePath) {
    try {
        const buffer = await readFile(filePath);
        if (buffer.length < 4)
            return false;
        // Check magic bytes for common formats
        // JPEG: FF D8 FF
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            return true;
        }
        // PNG: 89 50 4E 47
        if (buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47) {
            return true;
        }
        // WebP: RIFF....WEBP
        if (buffer[0] === 0x52 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x46 &&
            buffer.length >= 12 &&
            buffer[8] === 0x57 &&
            buffer[9] === 0x45 &&
            buffer[10] === 0x42 &&
            buffer[11] === 0x50) {
            return true;
        }
        // AVIF: ....ftypavif or ....ftypmif1
        if (buffer.length >= 12) {
            const ftyp = buffer.slice(4, 8).toString('ascii');
            if (ftyp === 'ftyp') {
                const brand = buffer.slice(8, 12).toString('ascii');
                if (brand === 'avif' || brand === 'mif1' || brand === 'heic') {
                    return true;
                }
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Detect format from magic bytes
 */
async function detectFormat(filePath) {
    try {
        const buffer = await readFile(filePath);
        if (buffer.length < 4)
            return null;
        // JPEG
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            return 'jpeg';
        }
        // PNG
        if (buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47) {
            return 'png';
        }
        // WebP
        if (buffer[0] === 0x52 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x46 &&
            buffer.length >= 12 &&
            buffer[8] === 0x57 &&
            buffer[9] === 0x45 &&
            buffer[10] === 0x42 &&
            buffer[11] === 0x50) {
            return 'webp';
        }
        // AVIF
        if (buffer.length >= 12) {
            const ftyp = buffer.slice(4, 8).toString('ascii');
            if (ftyp === 'ftyp') {
                const brand = buffer.slice(8, 12).toString('ascii');
                if (brand === 'avif' || brand === 'mif1') {
                    return 'avif';
                }
            }
        }
        // GIF
        if (buffer.slice(0, 3).toString('ascii') === 'GIF') {
            return 'gif';
        }
        return null;
    }
    catch {
        return null;
    }
}
// Skip all tests if Sharp is not available
const sharpAvailable = isSharpAvailable();
const describeWithSharp = sharpAvailable ? describe : describe.skip;
describeWithSharp('CLI Integration Tests', { timeout: 300000 }, () => {
    // Setup: Create temp directories
    beforeAll(async () => {
        // Clean up any existing temp directory
        if (existsSync(TEMP_DIR)) {
            await rm(TEMP_DIR, { recursive: true, force: true });
        }
        await mkdir(TEMP_DIR, { recursive: true });
        await mkdir(BATCH_DIR, { recursive: true });
    });
    // Cleanup: Remove temp directories
    afterAll(async () => {
        if (existsSync(TEMP_DIR)) {
            await rm(TEMP_DIR, { recursive: true, force: true });
        }
    });
    // Clean output files before each test
    beforeEach(async () => {
        // Remove any output files from previous tests, but keep batch dir structure
        const files = await readdir(TEMP_DIR);
        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            if (file !== 'batch') {
                const fileStat = await stat(filePath);
                if (fileStat.isFile()) {
                    await rm(filePath);
                }
            }
        }
    });
    describe('Single File Compression Tests (TC-CLI-001, TC-CLI-002)', () => {
        it('should compress a JPEG file with MozJPEG', { timeout: 60000 }, async () => {
            const inputPath = FIXTURES.mediumJpg;
            await getFileSize(inputPath); // Verify file exists
            const result = runCli([
                'compress',
                inputPath,
                '-f',
                'mozjpeg',
                '-q',
                '75',
                '-o',
                TEMP_DIR,
            ]);
            // Check CLI exited successfully
            expect(result.exitCode).toBe(0);
            // Find output file
            const outputPath = path.join(TEMP_DIR, 'medium.jpg');
            expect(existsSync(outputPath)).toBe(true);
            // Verify output is valid
            const compressedSize = await getFileSize(outputPath);
            expect(compressedSize).toBeGreaterThan(0);
            // Verify it's a valid JPEG
            expect(await isValidImage(outputPath)).toBe(true);
            expect(await detectFormat(outputPath)).toBe('jpeg');
        });
        it('should compress a PNG file with OxiPNG', { timeout: 60000 }, async () => {
            const inputPath = FIXTURES.mediumPng;
            const originalSize = await getFileSize(inputPath);
            const result = runCli([
                'compress',
                inputPath,
                '-f',
                'oxipng',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'medium.png');
            expect(existsSync(outputPath)).toBe(true);
            const compressedSize = await getFileSize(outputPath);
            expect(compressedSize).toBeGreaterThan(0);
            // OxiPNG should produce smaller files
            expect(compressedSize).toBeLessThanOrEqual(originalSize);
            expect(await isValidImage(outputPath)).toBe(true);
            expect(await detectFormat(outputPath)).toBe('png');
        });
        it('should compress to WebP format', { timeout: 60000 }, async () => {
            const inputPath = FIXTURES.mediumJpg;
            const originalSize = await getFileSize(inputPath);
            const result = runCli([
                'compress',
                inputPath,
                '-f',
                'webp',
                '-q',
                '80',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            // WebP output has different extension
            const outputPath = path.join(TEMP_DIR, 'medium.webp');
            expect(existsSync(outputPath)).toBe(true);
            const compressedSize = await getFileSize(outputPath);
            expect(compressedSize).toBeGreaterThan(0);
            // WebP is typically much smaller than JPEG
            expect(compressedSize).toBeLessThan(originalSize);
            expect(await isValidImage(outputPath)).toBe(true);
            expect(await detectFormat(outputPath)).toBe('webp');
        });
        it('should compress to AVIF format', { timeout: 120000 }, async () => {
            const inputPath = FIXTURES.smallJpg;
            const result = runCli([
                'compress',
                inputPath,
                '-f',
                'avif',
                '-q',
                '60',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'small.avif');
            expect(existsSync(outputPath)).toBe(true);
            const compressedSize = await getFileSize(outputPath);
            expect(compressedSize).toBeGreaterThan(0);
            expect(await isValidImage(outputPath)).toBe(true);
            expect(await detectFormat(outputPath)).toBe('avif');
        });
        it('should handle output file with suffix', { timeout: 60000 }, async () => {
            const inputPath = FIXTURES.smallJpg;
            const result = runCli([
                'compress',
                inputPath,
                '-f',
                'mozjpeg',
                '-o',
                TEMP_DIR,
                '--suffix',
                '-compressed',
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'small-compressed.jpg');
            expect(existsSync(outputPath)).toBe(true);
            expect(await isValidImage(outputPath)).toBe(true);
        });
    });
    describe('Format Detection Tests (TC-CLI-009)', () => {
        it('should correctly detect JPEG input format', { timeout: 10000 }, async () => {
            const format = await detectFormat(FIXTURES.smallJpg);
            expect(format).toBe('jpeg');
        });
        it('should correctly detect PNG input format', { timeout: 10000 }, async () => {
            const format = await detectFormat(FIXTURES.smallRgb);
            expect(format).toBe('png');
        });
        it('should correctly detect WebP input format', { timeout: 10000 }, async () => {
            const format = await detectFormat(FIXTURES.smallWebp);
            expect(format).toBe('webp');
        });
        it('should correctly detect GIF input format', { timeout: 10000 }, async () => {
            const format = await detectFormat(FIXTURES.smallGif);
            expect(format).toBe('gif');
        });
        it('should process JPEG input correctly', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.smallJpg,
                '-f',
                'webp',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'small.webp');
            expect(existsSync(outputPath)).toBe(true);
        });
        it('should process PNG input correctly', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.smallRgb,
                '-f',
                'webp',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'small-rgb.webp');
            expect(existsSync(outputPath)).toBe(true);
        });
        it('should process WebP input correctly', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.smallWebp,
                '-f',
                'mozjpeg',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'small.jpg');
            expect(existsSync(outputPath)).toBe(true);
        });
    });
    describe('Quality Parameter Tests (TC-CLI-003)', () => {
        it('should produce smaller files with lower quality', { timeout: 120000 }, async () => {
            const inputPath = FIXTURES.gradient; // Use gradient for visible quality differences
            // Compress with low quality
            const lowQualityResult = runCli([
                'compress',
                inputPath,
                '-f',
                'mozjpeg',
                '-q',
                '10',
                '-o',
                TEMP_DIR,
                '--suffix',
                '-q10',
            ]);
            expect(lowQualityResult.exitCode).toBe(0);
            // Compress with high quality
            const highQualityResult = runCli([
                'compress',
                inputPath,
                '-f',
                'mozjpeg',
                '-q',
                '90',
                '-o',
                TEMP_DIR,
                '--suffix',
                '-q90',
            ]);
            expect(highQualityResult.exitCode).toBe(0);
            const lowQualityPath = path.join(TEMP_DIR, 'gradient-q10.jpg');
            const highQualityPath = path.join(TEMP_DIR, 'gradient-q90.jpg');
            expect(existsSync(lowQualityPath)).toBe(true);
            expect(existsSync(highQualityPath)).toBe(true);
            const lowQualitySize = await getFileSize(lowQualityPath);
            const highQualitySize = await getFileSize(highQualityPath);
            // Low quality should produce significantly smaller files
            expect(lowQualitySize).toBeLessThan(highQualitySize);
        });
        it('should produce smaller WebP files with lower quality', { timeout: 120000 }, async () => {
            const inputPath = FIXTURES.gradient;
            // Compress with low quality
            const lowQualityResult = runCli([
                'compress',
                inputPath,
                '-f',
                'webp',
                '-q',
                '10',
                '-o',
                TEMP_DIR,
                '--suffix',
                '-q10',
            ]);
            expect(lowQualityResult.exitCode).toBe(0);
            // Compress with high quality
            const highQualityResult = runCli([
                'compress',
                inputPath,
                '-f',
                'webp',
                '-q',
                '95',
                '-o',
                TEMP_DIR,
                '--suffix',
                '-q95',
            ]);
            expect(highQualityResult.exitCode).toBe(0);
            const lowQualityPath = path.join(TEMP_DIR, 'gradient-q10.webp');
            const highQualityPath = path.join(TEMP_DIR, 'gradient-q95.webp');
            const lowQualitySize = await getFileSize(lowQualityPath);
            const highQualitySize = await getFileSize(highQualityPath);
            expect(lowQualitySize).toBeLessThan(highQualitySize);
        });
        it('should use default quality when not specified', { timeout: 60000 }, async () => {
            const inputPath = FIXTURES.smallJpg;
            // Compress without quality flag (should use default 75)
            const result = runCli([
                'compress',
                inputPath,
                '-f',
                'mozjpeg',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'small.jpg');
            expect(existsSync(outputPath)).toBe(true);
            // File should exist and be valid
            const compressedSize = await getFileSize(outputPath);
            expect(compressedSize).toBeGreaterThan(0);
            expect(await isValidImage(outputPath)).toBe(true);
        });
    });
    describe('Error Handling Tests (TC-CLI-010)', () => {
        it('should error on non-existent file', { timeout: 30000 }, async () => {
            const result = runCli([
                'compress',
                '/nonexistent/path/to/image.jpg',
                '-f',
                'mozjpeg',
                '-o',
                TEMP_DIR,
            ]);
            // Should exit with error
            expect(result.exitCode).not.toBe(0);
            // Should have error message in output
            expect(result.stderr + result.stdout).toMatch(/error|not found|ENOENT|no such file/i);
        });
        it('should error on invalid format name', { timeout: 30000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.smallJpg,
                '-f',
                'invalidformat',
                '-o',
                TEMP_DIR,
            ]);
            // Should exit with error
            expect(result.exitCode).not.toBe(0);
            // Should mention unknown format
            expect(result.stderr + result.stdout).toMatch(/unknown format|invalid|not supported/i);
        });
        it('should error on unsupported input file extension', { timeout: 30000 }, async () => {
            // Create a fake file with unsupported extension
            const fakePath = path.join(TEMP_DIR, 'fake.bmp');
            await writeFile(fakePath, 'not a real image');
            const result = runCli([
                'compress',
                fakePath,
                '-f',
                'mozjpeg',
                '-o',
                TEMP_DIR,
            ]);
            // Should exit with error or report unsupported
            expect(result.exitCode).not.toBe(0);
        });
        it('should handle empty input path gracefully', { timeout: 30000 }, async () => {
            const result = runCli(['compress', '', '-f', 'mozjpeg']);
            // Should exit with error
            expect(result.exitCode).not.toBe(0);
        });
    });
    describe('Batch Processing Tests (TC-CLI-004)', () => {
        beforeEach(async () => {
            // Clean and recreate batch directory
            if (existsSync(BATCH_DIR)) {
                await rm(BATCH_DIR, { recursive: true, force: true });
            }
            await mkdir(BATCH_DIR, { recursive: true });
            // Copy test images to batch directory
            await copyFile(FIXTURES.smallJpg, path.join(BATCH_DIR, 'image1.jpg'));
            await copyFile(FIXTURES.smallRgb, path.join(BATCH_DIR, 'image2.png'));
            await copyFile(FIXTURES.gradient, path.join(BATCH_DIR, 'image3.png'));
        });
        it('should process multiple files in a directory', { timeout: 180000 }, async () => {
            const outputDir = path.join(TEMP_DIR, 'batch-output');
            await mkdir(outputDir, { recursive: true });
            const result = runCli([
                'compress',
                BATCH_DIR,
                '-f',
                'webp',
                '-q',
                '75',
                '-o',
                outputDir,
            ]);
            expect(result.exitCode).toBe(0);
            // Check that all files were processed
            const outputFiles = await readdir(outputDir);
            const webpFiles = outputFiles.filter((f) => f.endsWith('.webp'));
            expect(webpFiles.length).toBe(3);
            expect(webpFiles).toContain('image1.webp');
            expect(webpFiles).toContain('image2.webp');
            expect(webpFiles).toContain('image3.webp');
            // Verify all outputs are valid
            for (const webpFile of webpFiles) {
                const filePath = path.join(outputDir, webpFile);
                expect(await isValidImage(filePath)).toBe(true);
            }
        });
        it('should process only specified extensions', { timeout: 120000 }, async () => {
            const outputDir = path.join(TEMP_DIR, 'batch-ext-output');
            await mkdir(outputDir, { recursive: true });
            const result = runCli([
                'compress',
                BATCH_DIR,
                '-f',
                'mozjpeg',
                '-o',
                outputDir,
                '--ext',
                'jpg', // Only process JPG files
            ]);
            expect(result.exitCode).toBe(0);
            const outputFiles = await readdir(outputDir);
            const jpgFiles = outputFiles.filter((f) => f.endsWith('.jpg'));
            // Only 1 JPG file in batch directory
            expect(jpgFiles.length).toBe(1);
            expect(jpgFiles).toContain('image1.jpg');
        });
        it('should continue on error when flag is set', { timeout: 180000 }, async () => {
            // Create a corrupted file
            const corruptPath = path.join(BATCH_DIR, 'corrupt.jpg');
            await writeFile(corruptPath, 'this is not a valid jpeg');
            const outputDir = path.join(TEMP_DIR, 'batch-continue-output');
            await mkdir(outputDir, { recursive: true });
            const result = runCli([
                'compress',
                BATCH_DIR,
                '-f',
                'webp',
                '-o',
                outputDir,
                '--continue-on-error',
                '--ext',
                'jpg,png',
            ]);
            // Should complete (possibly with errors reported)
            // The valid files should still be processed
            const outputFiles = await readdir(outputDir);
            const webpFiles = outputFiles.filter((f) => f.endsWith('.webp'));
            // At least the valid files should be processed
            expect(webpFiles.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('CLI Help and Info Commands', () => {
        it('should display help when no command given', { timeout: 30000 }, async () => {
            const result = runCli([]);
            // Should show usage info
            expect(result.stdout + result.stderr).toMatch(/usage|squoosh|compress/i);
        });
        it('should display available formats', { timeout: 30000 }, async () => {
            const result = runCli(['formats']);
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toMatch(/mozjpeg/i);
            expect(result.stdout).toMatch(/webp/i);
            expect(result.stdout).toMatch(/avif/i);
            expect(result.stdout).toMatch(/oxipng|png/i);
        });
        it('should display version', { timeout: 30000 }, async () => {
            const result = runCli(['--version']);
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
        });
        it('should display help for compress command', { timeout: 30000 }, async () => {
            const result = runCli(['compress', '--help']);
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toMatch(/format/i);
            expect(result.stdout).toMatch(/quality/i);
            expect(result.stdout).toMatch(/output/i);
        });
    });
    describe('Edge Cases', () => {
        it('should handle very small images (1x1)', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.tiny,
                '-f',
                'webp',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'tiny.webp');
            expect(existsSync(outputPath)).toBe(true);
            expect(await isValidImage(outputPath)).toBe(true);
        });
        it('should handle wide images', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.wide,
                '-f',
                'mozjpeg',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'wide.jpg');
            expect(existsSync(outputPath)).toBe(true);
            expect(await isValidImage(outputPath)).toBe(true);
        });
        it('should handle tall images', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.tall,
                '-f',
                'mozjpeg',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'tall.jpg');
            expect(existsSync(outputPath)).toBe(true);
            expect(await isValidImage(outputPath)).toBe(true);
        });
        it('should handle images with transparency (RGBA)', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.smallRgba,
                '-f',
                'webp', // WebP supports transparency
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'small-rgba.webp');
            expect(existsSync(outputPath)).toBe(true);
            expect(await isValidImage(outputPath)).toBe(true);
        });
        it('should handle checkerboard pattern (high frequency content)', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.checkerboard,
                '-f',
                'mozjpeg',
                '-q',
                '85',
                '-o',
                TEMP_DIR,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'checkerboard.jpg');
            expect(existsSync(outputPath)).toBe(true);
            expect(await isValidImage(outputPath)).toBe(true);
        });
    });
    describe('Output Options', () => {
        it('should respect output directory option', { timeout: 60000 }, async () => {
            const customOutputDir = path.join(TEMP_DIR, 'custom-output');
            await mkdir(customOutputDir, { recursive: true });
            const result = runCli([
                'compress',
                FIXTURES.smallJpg,
                '-f',
                'webp',
                '-o',
                customOutputDir,
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(customOutputDir, 'small.webp');
            expect(existsSync(outputPath)).toBe(true);
        });
        it('should apply suffix to output filename', { timeout: 60000 }, async () => {
            const result = runCli([
                'compress',
                FIXTURES.smallJpg,
                '-f',
                'mozjpeg',
                '-o',
                TEMP_DIR,
                '--suffix',
                '_optimized',
            ]);
            expect(result.exitCode).toBe(0);
            const outputPath = path.join(TEMP_DIR, 'small_optimized.jpg');
            expect(existsSync(outputPath)).toBe(true);
        });
    });
});
// Additional test for when Sharp is not available
describe('Sharp Availability Check', () => {
    it('should correctly report Sharp availability', () => {
        const available = isSharpAvailable();
        // Just verify the function runs without error
        expect(typeof available).toBe('boolean');
    });
});
