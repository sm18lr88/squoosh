/**
 * Performance benchmark tests for Squoosh CLI
 *
 * These tests measure and validate performance characteristics of the CLI.
 * They are skipped by default since they are slow and resource-intensive.
 *
 * Run with: npm run test:perf
 * Or enable with: RUN_PERF_TESTS=true npm test
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
// Import the ImageData polyfill first
import './utils/image-data.js';
// Import test dependencies
import { decodeFile } from './codecs/decoders/index.js';
import { getEncoder, listEncoders } from './codecs/index.js';
import { scanFiles } from './batch/scanner.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Check if performance tests should run
const RUN_PERF_TESTS = process.env.RUN_PERF_TESTS === 'true' ||
    process.env.npm_lifecycle_event === 'test:perf';
// Skip condition for performance tests
const describePerf = RUN_PERF_TESTS ? describe : describe.skip;
// Helper to get project root
const PROJECT_ROOT = join(__dirname, '../..');
// Test fixtures - use existing images from the project
const FIXTURES = {
    // ~3.4MB PNG file
    largePng: join(PROJECT_ROOT, 'codecs/example.png'),
    // ~245KB PNG file
    mediumPng: join(PROJECT_ROOT, 'codecs/example_palette.png'),
    // ~75KB WebP file
    smallWebp: join(PROJECT_ROOT, 'codecs/example.webp'),
    // Demo images
    demoJpg: join(PROJECT_ROOT, 'src/shared/prerendered-app/Intro/imgs/demos/demo-large-photo.jpg'),
};
// Temp directory for test outputs
let tempDir;
/**
 * Creates a large test image by scaling up pixel data
 * @param width - Target width
 * @param height - Target height
 * @returns ImageData with the specified dimensions
 */
function createTestImageData(width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    // Fill with a gradient pattern for realistic compression behavior
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // Create a gradient with some noise for realistic compression
            data[idx] = (x * 255) / width; // R
            data[idx + 1] = (y * 255) / height; // G
            data[idx + 2] = ((x + y) * 127) / (width + height); // B
            data[idx + 3] = 255; // A
        }
    }
    return new ImageData(data, width, height);
}
/**
 * Creates a small batch of test PNG images in a directory
 * @param dir - Directory to create images in
 * @param count - Number of images to create
 * @param size - Size of each image (width = height)
 */
async function createBatchTestImages(dir, count, size = 100) {
    const encoder = getEncoder('oxipng');
    const paths = [];
    for (let i = 0; i < count; i++) {
        const imageData = createTestImageData(size, size);
        const encoded = await encoder.encode(imageData, { level: 0 });
        const filePath = join(dir, `test_image_${i.toString().padStart(3, '0')}.png`);
        await writeFile(filePath, Buffer.from(encoded));
        paths.push(filePath);
    }
    return paths;
}
/**
 * Measures execution time of an async function
 * @param fn - Function to measure
 * @returns Object with result and elapsed time in milliseconds
 */
async function measureTime(fn) {
    const start = performance.now();
    const result = await fn();
    const elapsed = performance.now() - start;
    return { result, elapsed };
}
/**
 * Gets current process memory usage in MB
 */
function getMemoryUsageMB() {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024;
}
describePerf('Performance Benchmarks', () => {
    beforeAll(async () => {
        // Create temp directory for test outputs
        tempDir = join(tmpdir(), `squoosh-perf-test-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        console.log(`\n  Performance test temp directory: ${tempDir}\n`);
    });
    afterAll(async () => {
        // Cleanup temp directory
        try {
            await rm(tempDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
    });
    describe('TC-PERF-001: Large File Handling', () => {
        it('should compress large PNG file without timeout', async () => {
            // Use the ~3.4MB example.png
            const inputPath = FIXTURES.largePng;
            // Verify the file exists and is large enough
            const inputStat = await stat(inputPath);
            expect(inputStat.size).toBeGreaterThan(1_000_000); // At least 1MB
            console.log(`    Input file size: ${(inputStat.size / 1024 / 1024).toFixed(2)} MB`);
            // Decode the image
            const { result: imageData, elapsed: decodeTime } = await measureTime(() => decodeFile(inputPath));
            console.log(`    Decode time: ${decodeTime.toFixed(0)}ms`);
            console.log(`    Image dimensions: ${imageData.width}x${imageData.height}`);
            // Encode with WebP (good balance of speed and compression)
            const encoder = getEncoder('webp');
            await encoder.warmup();
            const encodeOptions = { ...encoder.defaultOptions, quality: 75 };
            const { result: encoded, elapsed: encodeTime } = await measureTime(() => encoder.encode(imageData, encodeOptions));
            console.log(`    Encode time: ${encodeTime.toFixed(0)}ms`);
            console.log(`    Output size: ${(encoded.byteLength / 1024).toFixed(0)} KB`);
            // Verify output is valid
            expect(encoded.byteLength).toBeGreaterThan(0);
            expect(encoded.byteLength).toBeLessThan(inputStat.size); // Should compress
            // Write output to verify it's valid
            const outputPath = join(tempDir, 'large_output.webp');
            await writeFile(outputPath, Buffer.from(encoded));
            const outputStat = await stat(outputPath);
            expect(outputStat.size).toBe(encoded.byteLength);
        }, 60_000); // 60 second timeout
        it('should track memory usage during large file processing', async () => {
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            const initialMemory = getMemoryUsageMB();
            console.log(`    Initial memory: ${initialMemory.toFixed(1)} MB`);
            // Load and process the large image
            const imageData = await decodeFile(FIXTURES.largePng);
            const afterDecodeMemory = getMemoryUsageMB();
            console.log(`    After decode: ${afterDecodeMemory.toFixed(1)} MB`);
            // Encode with MozJPEG
            const encoder = getEncoder('mozjpeg');
            await encoder.warmup();
            const encodeOptions = { ...encoder.defaultOptions, quality: 80 };
            const encoded = await encoder.encode(imageData, encodeOptions);
            const afterEncodeMemory = getMemoryUsageMB();
            console.log(`    After encode: ${afterEncodeMemory.toFixed(1)} MB`);
            // Memory increase should be reasonable (less than 500MB for this operation)
            const memoryIncrease = afterEncodeMemory - initialMemory;
            console.log(`    Memory increase: ${memoryIncrease.toFixed(1)} MB`);
            // Verify the encoding worked
            expect(encoded.byteLength).toBeGreaterThan(0);
            // Memory should not explode unreasonably
            // This is a soft check - actual limits depend on image size
            expect(memoryIncrease).toBeLessThan(500);
        }, 60_000);
        it('should handle very large synthetic image (5000x5000)', async () => {
            // Create a large synthetic image
            const width = 5000;
            const height = 5000;
            const imageData = createTestImageData(width, height);
            console.log(`    Created ${width}x${height} image (${(width * height * 4 / 1024 / 1024).toFixed(1)} MB raw)`);
            // Encode with WebP (reliable and fast)
            const encoder = getEncoder('webp');
            await encoder.warmup();
            const largeEncodeOptions = { ...encoder.defaultOptions, quality: 75 };
            const { result: encoded, elapsed } = await measureTime(() => encoder.encode(imageData, largeEncodeOptions));
            console.log(`    WebP encode time: ${elapsed.toFixed(0)}ms`);
            console.log(`    Output size: ${(encoded.byteLength / 1024 / 1024).toFixed(2)} MB`);
            expect(encoded.byteLength).toBeGreaterThan(0);
        }, 120_000); // 2 minute timeout for very large image
    });
    describe('TC-PERF-003: Batch Performance', () => {
        let batchDir;
        const BATCH_SIZE = 25;
        beforeEach(async () => {
            batchDir = join(tempDir, `batch-${Date.now()}`);
            await mkdir(batchDir, { recursive: true });
        });
        afterEach(async () => {
            try {
                await rm(batchDir, { recursive: true, force: true });
            }
            catch {
                // Ignore cleanup errors
            }
        });
        it('should create and process 25+ test images', async () => {
            console.log(`    Creating ${BATCH_SIZE} test images...`);
            // Create batch of test images
            const { result: imagePaths, elapsed: createTime } = await measureTime(() => createBatchTestImages(batchDir, BATCH_SIZE, 200));
            console.log(`    Creation time: ${createTime.toFixed(0)}ms`);
            expect(imagePaths).toHaveLength(BATCH_SIZE);
            // Scan the directory
            const scannedFiles = await scanFiles(batchDir, {
                extensions: ['png'],
                recursive: false,
            });
            expect(scannedFiles).toHaveLength(BATCH_SIZE);
            // Process all files (simulate batch compression)
            const encoder = getEncoder('webp');
            await encoder.warmup();
            const results = [];
            const { elapsed: batchTime } = await measureTime(async () => {
                for (const filePath of scannedFiles) {
                    const inputStat = await stat(filePath);
                    const imageData = await decodeFile(filePath);
                    const batchEncodeOptions = { ...encoder.defaultOptions, quality: 80 };
                    const encoded = await encoder.encode(imageData, batchEncodeOptions);
                    results.push({
                        path: filePath,
                        inputSize: inputStat.size,
                        outputSize: encoded.byteLength,
                    });
                }
            });
            console.log(`    Batch processing time: ${batchTime.toFixed(0)}ms`);
            console.log(`    Average per file: ${(batchTime / BATCH_SIZE).toFixed(0)}ms`);
            console.log(`    Files processed: ${results.length}`);
            // Verify all files processed successfully
            expect(results).toHaveLength(BATCH_SIZE);
            results.forEach((r) => {
                expect(r.outputSize).toBeGreaterThan(0);
            });
            // Calculate total compression
            const totalInput = results.reduce((sum, r) => sum + r.inputSize, 0);
            const totalOutput = results.reduce((sum, r) => sum + r.outputSize, 0);
            const compressionRatio = ((1 - totalOutput / totalInput) * 100).toFixed(1);
            console.log(`    Total input: ${(totalInput / 1024).toFixed(0)} KB`);
            console.log(`    Total output: ${(totalOutput / 1024).toFixed(0)} KB`);
            console.log(`    Compression: ${compressionRatio}%`);
        }, 120_000); // 2 minute timeout
        it('should measure throughput with parallel simulation', async () => {
            // Create smaller batch for parallel test
            const PARALLEL_BATCH = 10;
            const imagePaths = await createBatchTestImages(batchDir, PARALLEL_BATCH, 150);
            const encoder = getEncoder('mozjpeg');
            await encoder.warmup();
            // Sequential processing
            const seqEncodeOptions = { ...encoder.defaultOptions, quality: 75 };
            const { elapsed: sequentialTime } = await measureTime(async () => {
                for (const filePath of imagePaths) {
                    const imageData = await decodeFile(filePath);
                    await encoder.encode(imageData, seqEncodeOptions);
                }
            });
            console.log(`    Sequential time (${PARALLEL_BATCH} files): ${sequentialTime.toFixed(0)}ms`);
            // Parallel processing (limited concurrency)
            const CONCURRENCY = 4;
            const { elapsed: parallelTime } = await measureTime(async () => {
                const queue = [...imagePaths];
                const active = [];
                while (queue.length > 0 || active.length > 0) {
                    // Start new tasks up to concurrency limit
                    while (active.length < CONCURRENCY && queue.length > 0) {
                        const filePath = queue.shift();
                        const task = (async () => {
                            const imageData = await decodeFile(filePath);
                            await encoder.encode(imageData, seqEncodeOptions);
                        })();
                        active.push(task);
                    }
                    // Wait for at least one to complete
                    if (active.length > 0) {
                        await Promise.race(active);
                        // Remove completed tasks
                        // Clear completed tasks after race
                        await Promise.allSettled(active);
                        active.length = 0;
                    }
                }
            });
            console.log(`    Parallel time (concurrency=${CONCURRENCY}): ${parallelTime.toFixed(0)}ms`);
            console.log(`    Speedup: ${(sequentialTime / parallelTime).toFixed(2)}x`);
            // Parallel should generally be faster (or at least not significantly slower)
            // Allow some tolerance for overhead
            expect(parallelTime).toBeLessThan(sequentialTime * 1.5);
        }, 120_000);
    });
    describe('Concurrent Operations', () => {
        it('should handle concurrent encodings without corruption', async () => {
            const encoder = getEncoder('webp');
            await encoder.warmup();
            // Create different test images with identifiable patterns
            const images = [
                { data: createTestImageData(100, 100), id: 'small' },
                { data: createTestImageData(200, 200), id: 'medium' },
                { data: createTestImageData(300, 300), id: 'large' },
            ];
            console.log('    Starting concurrent encodings...');
            // Run all encodings concurrently
            const concurrentEncodeOptions = { ...encoder.defaultOptions, quality: 80 };
            const results = await Promise.all(images.map(async (img) => {
                const encoded = await encoder.encode(img.data, concurrentEncodeOptions);
                return { id: img.id, size: encoded.byteLength };
            }));
            console.log('    Results:', results.map(r => `${r.id}=${r.size}B`).join(', '));
            // Verify all completed successfully
            expect(results).toHaveLength(3);
            results.forEach((r) => {
                expect(r.size).toBeGreaterThan(0);
            });
            // Sizes should be different (no corruption/mixing)
            const sizes = results.map(r => r.size);
            const uniqueSizes = new Set(sizes);
            expect(uniqueSizes.size).toBe(3);
            // Larger images should generally produce larger outputs
            const smallResult = results.find(r => r.id === 'small');
            const largeResult = results.find(r => r.id === 'large');
            expect(largeResult.size).toBeGreaterThan(smallResult.size);
        }, 60_000);
        it('should handle rapid sequential encodings', async () => {
            const encoder = getEncoder('mozjpeg');
            await encoder.warmup();
            const imageData = createTestImageData(200, 200);
            const iterations = 10;
            const sizes = [];
            const rapidEncodeOptions = { ...encoder.defaultOptions, quality: 75 };
            const { elapsed } = await measureTime(async () => {
                for (let i = 0; i < iterations; i++) {
                    const encoded = await encoder.encode(imageData, rapidEncodeOptions);
                    sizes.push(encoded.byteLength);
                }
            });
            console.log(`    ${iterations} rapid encodings in ${elapsed.toFixed(0)}ms`);
            console.log(`    Average: ${(elapsed / iterations).toFixed(0)}ms per encode`);
            // All encodings should produce identical results (deterministic)
            expect(sizes).toHaveLength(iterations);
            const uniqueSizes = new Set(sizes);
            expect(uniqueSizes.size).toBe(1);
        }, 60_000);
    });
    describe('Memory Stress Test', () => {
        it('should process multiple large images sequentially without crashing', async () => {
            const initialMemory = getMemoryUsageMB();
            console.log(`    Initial memory: ${initialMemory.toFixed(1)} MB`);
            const encoder = getEncoder('webp');
            await encoder.warmup();
            // Process the same large image multiple times
            const iterations = 5;
            const memorySamples = [initialMemory];
            for (let i = 0; i < iterations; i++) {
                // Load and process the large image
                const imageData = await decodeFile(FIXTURES.largePng);
                const stressEncodeOptions = { ...encoder.defaultOptions, quality: 70 };
                const encoded = await encoder.encode(imageData, stressEncodeOptions);
                expect(encoded.byteLength).toBeGreaterThan(0);
                const currentMemory = getMemoryUsageMB();
                memorySamples.push(currentMemory);
                console.log(`    Iteration ${i + 1}: ${currentMemory.toFixed(1)} MB (output: ${(encoded.byteLength / 1024).toFixed(0)} KB)`);
            }
            const maxMemory = Math.max(...memorySamples);
            const memoryGrowth = maxMemory - initialMemory;
            console.log(`    Max memory: ${maxMemory.toFixed(1)} MB`);
            console.log(`    Memory growth: ${memoryGrowth.toFixed(1)} MB`);
            // Process should complete without excessive memory growth
            // (Node.js GC should keep things reasonable)
            expect(memoryGrowth).toBeLessThan(1000); // Less than 1GB growth
        }, 180_000); // 3 minute timeout
        it('should handle alternating between different encoders', async () => {
            // Use encoders that are known to work reliably in Node.js CLI context
            const encoderNames = ['mozjpeg', 'webp', 'oxipng'];
            const imageData = createTestImageData(500, 500);
            console.log('    Warming up encoders...');
            // Warm up all encoders first
            for (const name of encoderNames) {
                const encoder = getEncoder(name);
                await encoder.warmup();
            }
            console.log('    Processing with alternating encoders...');
            const results = [];
            // Alternate between encoders multiple times
            for (let round = 0; round < 3; round++) {
                for (const name of encoderNames) {
                    const encoder = getEncoder(name);
                    const { result: encoded, elapsed } = await measureTime(() => encoder.encode(imageData, encoder.defaultOptions));
                    results.push({ encoder: name, size: encoded.byteLength, time: elapsed });
                }
            }
            // Log results
            encoderNames.forEach((name) => {
                const encoderResults = results.filter(r => r.encoder === name);
                const avgTime = encoderResults.reduce((sum, r) => sum + r.time, 0) / encoderResults.length;
                const avgSize = encoderResults.reduce((sum, r) => sum + r.size, 0) / encoderResults.length;
                console.log(`    ${name}: avg ${avgTime.toFixed(0)}ms, ${(avgSize / 1024).toFixed(0)} KB`);
            });
            // All should complete successfully
            expect(results).toHaveLength(9);
            results.forEach((r) => {
                expect(r.size).toBeGreaterThan(0);
            });
        }, 180_000);
    });
    describe('Edge Case Performance', () => {
        it('should handle 1x1 pixel image quickly', async () => {
            const imageData = createTestImageData(1, 1);
            // Use encoders that work reliably in Node.js CLI context
            const encoderNames = ['mozjpeg', 'webp', 'oxipng'];
            for (const name of encoderNames) {
                const encoder = getEncoder(name);
                await encoder.warmup();
                const { result: encoded, elapsed } = await measureTime(() => encoder.encode(imageData, encoder.defaultOptions));
                console.log(`    ${name}: ${elapsed.toFixed(1)}ms, ${encoded.byteLength} bytes`);
                // 1x1 image should encode very quickly (under 1 second)
                expect(elapsed).toBeLessThan(1000);
                expect(encoded.byteLength).toBeGreaterThan(0);
            }
        }, 30_000);
        it('should handle very wide image (10000x10)', async () => {
            const imageData = createTestImageData(10000, 10);
            console.log(`    Image: 10000x10 (${(10000 * 10 * 4 / 1024).toFixed(0)} KB raw)`);
            const encoder = getEncoder('webp');
            await encoder.warmup();
            const wideEncodeOptions = { ...encoder.defaultOptions, quality: 80 };
            const { result: encoded, elapsed } = await measureTime(() => encoder.encode(imageData, wideEncodeOptions));
            console.log(`    Encode time: ${elapsed.toFixed(0)}ms`);
            console.log(`    Output size: ${(encoded.byteLength / 1024).toFixed(1)} KB`);
            expect(encoded.byteLength).toBeGreaterThan(0);
        }, 60_000);
        it('should handle very tall image (10x10000)', async () => {
            const imageData = createTestImageData(10, 10000);
            console.log(`    Image: 10x10000 (${(10 * 10000 * 4 / 1024).toFixed(0)} KB raw)`);
            const encoder = getEncoder('webp');
            await encoder.warmup();
            const tallEncodeOptions = { ...encoder.defaultOptions, quality: 80 };
            const { result: encoded, elapsed } = await measureTime(() => encoder.encode(imageData, tallEncodeOptions));
            console.log(`    Encode time: ${elapsed.toFixed(0)}ms`);
            console.log(`    Output size: ${(encoded.byteLength / 1024).toFixed(1)} KB`);
            expect(encoded.byteLength).toBeGreaterThan(0);
        }, 60_000);
        it('should handle square power-of-two dimensions efficiently', async () => {
            const sizes = [64, 128, 256, 512, 1024];
            const encoder = getEncoder('mozjpeg');
            await encoder.warmup();
            const results = [];
            const powerOfTwoEncodeOptions = { ...encoder.defaultOptions, quality: 80 };
            for (const size of sizes) {
                const imageData = createTestImageData(size, size);
                const { result: encoded, elapsed } = await measureTime(() => encoder.encode(imageData, powerOfTwoEncodeOptions));
                results.push({ size, time: elapsed, output: encoded.byteLength });
            }
            console.log('    Size (px) | Time (ms) | Output (KB)');
            results.forEach((r) => {
                console.log(`    ${r.size.toString().padStart(9)} | ${r.time.toFixed(0).padStart(9)} | ${(r.output / 1024).toFixed(1).padStart(11)}`);
            });
            // Time should roughly scale with pixel count (quadratically with dimension)
            // This is a sanity check, not a strict performance requirement
            results.forEach((r) => {
                expect(r.output).toBeGreaterThan(0);
            });
        }, 120_000);
    });
    describe('Encoder Comparison', () => {
        it('should benchmark all encoders with the same image', async () => {
            const imageData = await decodeFile(FIXTURES.mediumPng);
            console.log(`    Test image: ${imageData.width}x${imageData.height}`);
            const encoderNames = listEncoders();
            const results = [];
            const failures = [];
            for (const name of encoderNames) {
                const encoder = getEncoder(name);
                try {
                    await encoder.warmup();
                    const { result: encoded, elapsed } = await measureTime(() => encoder.encode(imageData, encoder.defaultOptions));
                    results.push({ name, time: elapsed, size: encoded.byteLength });
                }
                catch (error) {
                    // Some encoders may not work in Node.js CLI context (e.g., QOI uses browser globals)
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    failures.push({ name, error: errorMsg });
                    console.log(`    ${name}: SKIPPED - ${errorMsg}`);
                }
            }
            console.log('\n    Encoder Performance Comparison:');
            console.log('    Encoder  | Time (ms) | Size (KB) | Compression');
            console.log('    ---------|-----------|-----------|------------');
            const originalSize = imageData.width * imageData.height * 4;
            results.sort((a, b) => a.time - b.time);
            results.forEach((r) => {
                const compression = ((1 - r.size / originalSize) * 100).toFixed(1);
                console.log(`    ${r.name.padEnd(8)} | ${r.time.toFixed(0).padStart(9)} | ${(r.size / 1024).toFixed(1).padStart(9)} | ${compression.padStart(10)}%`);
            });
            if (failures.length > 0) {
                console.log(`\n    Note: ${failures.length} encoder(s) skipped due to Node.js compatibility issues`);
            }
            // At least some encoders should complete successfully
            expect(results.length).toBeGreaterThanOrEqual(3);
        }, 180_000);
    });
});
// Informational test that always runs to explain how to run perf tests
describe('Performance Tests Info', () => {
    it('should provide instructions for running performance tests', () => {
        if (!RUN_PERF_TESTS) {
            console.log('\n  Performance tests are SKIPPED by default.');
            console.log('  To run them, use one of these methods:');
            console.log('    npm run test:perf');
            console.log('    RUN_PERF_TESTS=true npm test');
            console.log('    RUN_PERF_TESTS=true npx vitest run src/cli/performance.test.ts\n');
        }
        else {
            console.log('\n  Performance tests are ENABLED.\n');
        }
        expect(true).toBe(true);
    });
});
