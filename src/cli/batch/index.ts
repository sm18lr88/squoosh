/**
 * Batch processing module for Squoosh CLI
 * Handles compression of multiple image files with progress reporting
 * Supports parallel processing for improved performance
 */

import chalk from 'chalk';
import { stat, unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import { cpus } from 'node:os';
import { scanFiles, parseExtensions } from './scanner.js';
import { getEncoder } from '../codecs/index.js';
import { decodeFile } from '../codecs/decoders/index.js';
import { writeOutputFile, type OutputOptions } from '../utils/output.js';
import { createProgressReporter, formatBytes } from '../utils/progress.js';
import {
  isSharpAvailable,
  isFormatSupportedBySharp,
  processWithSharp,
} from '../codecs/sharp-backend.js';
import {
  isNativeAvailable,
  processWithNative,
  getOptimalConcurrency,
} from '../codecs/native-backend.js';

/**
 * Options for the compress command
 */
export interface CompressOptions {
  /** Output format (encoder name) */
  format: string;
  /** Quality level as string */
  quality: string;
  /** Output directory path */
  output?: string;
  /** Whether to process subdirectories */
  recursive?: boolean;
  /** Comma-separated list of file extensions to process */
  ext: string;
  /** Suffix to add before the new extension */
  suffix?: string;
  /** Resize specification (e.g., "800x600") */
  resize?: string;
  /** Number of parallel workers */
  parallel: string;
  /** Whether to continue processing after errors */
  continueOnError?: boolean;
  /** Whether to replace original files after successful compression */
  replace?: boolean;
  /** Use Sharp (native libvips) for faster processing when available */
  fast?: boolean;
}

/**
 * Result of processing a single file
 */
export interface ProcessResult {
  /** Path to the input file */
  inputPath: string;
  /** Path to the output file (if successful) */
  outputPath?: string;
  /** Original file size in bytes */
  originalSize: number;
  /** Compressed file size in bytes (if successful) */
  compressedSize?: number;
  /** Whether processing was successful */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Options for the file processing function
 */
interface ProcessingOptions {
  /** Whether to continue processing after errors */
  continueOnError: boolean;
  /** Number of parallel workers */
  parallel: number;
  /** Whether to replace original files */
  replace: boolean;
  /** Use Sharp backend for faster processing */
  useSharp: boolean;
  /** Use native CLI tools for faster processing */
  useNative: boolean;
  /** Quality level for encoding */
  quality: number;
  /** Output format */
  format: string;
}

/**
 * Runs the compress command on the specified input
 * @param input - Path to file or directory to process
 * @param options - Compression options
 */
export async function runCompress(input: string, options: CompressOptions): Promise<void> {
  // 1. Validate format
  const encoder = getEncoder(options.format);
  if (!encoder) {
    throw new Error(`Unknown format: ${options.format}. Use 'squoosh formats' to list available formats.`);
  }

  // 2. Scan for files
  console.log(chalk.cyan('\n  Scanning for files...\n'));
  const extensions = parseExtensions(options.ext);
  const files = await scanFiles(input, {
    extensions,
    recursive: options.recursive ?? false,
  });

  if (files.length === 0) {
    console.log(chalk.yellow('  No files found matching criteria.\n'));
    return;
  }

  console.log(chalk.green(`  Found ${files.length} file(s)\n`));

  // 3. Determine backend and initialize
  const quality = Number.parseInt(options.quality, 10);
  const wantFast = options.fast ?? true; // Default to fast mode
  const sharpAvailable = isSharpAvailable();
  const formatSupportedBySharp = isFormatSupportedBySharp(options.format);
  const nativeAvailable = await isNativeAvailable(options.format);

  // Select best available backend
  let useSharp = false;
  let useNative = false;
  let backend: 'sharp' | 'native' | 'wasm' = 'wasm';

  if (wantFast) {
    if (sharpAvailable && formatSupportedBySharp) {
      useSharp = true;
      backend = 'sharp';
      console.log(chalk.green('  Using Sharp (native libvips) backend - HIGH PERFORMANCE MODE\n'));
    } else if (nativeAvailable) {
      useNative = true;
      backend = 'native';
      console.log(chalk.green(`  Using native CLI tools backend - HIGH PERFORMANCE MODE\n`));
    } else {
      console.log(chalk.yellow(`  Note: No fast backend available for ${options.format}, using WASM\n`));
    }
  }

  if (!useSharp && !useNative) {
    // Pre-warm WASM module for faster processing
    console.log(chalk.gray('  Initializing WASM encoder...'));
    const warmupStart = Date.now();
    await encoder.warmup();
    console.log(chalk.gray(`  Encoder ready (${Date.now() - warmupStart}ms)\n`));
  }

  // 4. Auto-select optimal concurrency based on backend
  const cpuCount = cpus().length;
  const manualParallel = options.parallel ? Number.parseInt(options.parallel, 10) : 0;
  const autoParallel = getOptimalConcurrency(backend, cpuCount);
  const parallelCount = manualParallel > 0 ? manualParallel : autoParallel;

  const outputOptions: OutputOptions = {
    outputDir: options.output,
    suffix: options.suffix,
    preserveStructure: options.recursive,
    inputBaseDir: input,
  };

  console.log(chalk.gray(`  Using ${parallelCount} parallel worker(s) (${backend} backend, ${cpuCount} CPUs)\n`));

  const results = await processFiles(files, encoder, quality, outputOptions, {
    continueOnError: options.continueOnError ?? false,
    parallel: parallelCount,
    replace: options.replace ?? false,
    useSharp,
    useNative,
    quality,
    format: options.format,
  });

  // 4. Report results
  reportResults(results);
}

/**
 * Processes an array of files with parallel execution
 * @param files - Array of file paths to process
 * @param encoder - Encoder to use for compression
 * @param quality - Quality level
 * @param outputOptions - Output file options
 * @param processingOptions - Processing behavior options
 * @returns Array of processing results
 */
async function processFiles(
  files: string[],
  encoder: ReturnType<typeof getEncoder>,
  quality: number,
  outputOptions: OutputOptions,
  processingOptions: ProcessingOptions
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = new Array(files.length);
  const progress = createProgressReporter('Processing');
  progress.start(files.length);

  let completedCount = 0;
  let activeCount = 0;
  let nextIndex = 0;
  let hasError = false;

  // Process files with concurrency limit
  await new Promise<void>((resolve, reject) => {
    const processNext = async () => {
      if (hasError && !processingOptions.continueOnError) {
        return;
      }

      if (nextIndex >= files.length) {
        if (activeCount === 0) {
          resolve();
        }
        return;
      }

      const currentIndex = nextIndex++;
      const file = files[currentIndex];
      const fileName = basename(file);
      activeCount++;

      try {
        const result = await processFile(
          file,
          encoder!,
          outputOptions,
          processingOptions
        );
        results[currentIndex] = result;
        completedCount++;
        progress.update(completedCount, fileName);
      } catch (error) {
        const errorResult: ProcessResult = {
          inputPath: file,
          originalSize: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
        results[currentIndex] = errorResult;
        completedCount++;

        if (!processingOptions.continueOnError) {
          hasError = true;
          progress.fail(`Failed on ${fileName}`);
          reject(error);
          return;
        }
        progress.update(completedCount, `${fileName} (failed)`);
      } finally {
        activeCount--;
        // Start next file
        processNext();
      }
    };

    // Start initial batch of workers
    const initialWorkers = Math.min(processingOptions.parallel, files.length);
    for (let i = 0; i < initialWorkers; i++) {
      processNext();
    }
  });

  progress.succeed('Processing complete');
  return results.filter(Boolean);
}

/**
 * Processes a single image file
 * @param inputPath - Path to the input file
 * @param encoder - Encoder to use (for WASM backend)
 * @param outputOptions - Output file options
 * @param processingOptions - Processing options including backend selection
 * @returns Processing result
 */
async function processFile(
  inputPath: string,
  encoder: NonNullable<ReturnType<typeof getEncoder>>,
  outputOptions: OutputOptions,
  processingOptions: ProcessingOptions
): Promise<ProcessResult> {
  const { useSharp, useNative, quality, replace: replaceOriginal, format } = processingOptions;

  // 1. Get original size
  const inputStat = await stat(inputPath);
  const originalSize = inputStat.size;

  let encoded: ArrayBuffer;

  if (useSharp) {
    // Fast path: Use Sharp for end-to-end processing
    encoded = await processWithSharp(inputPath, format, { quality });
  } else if (useNative) {
    // Native CLI tools path
    encoded = await processWithNative(inputPath, format, quality);
  } else {
    // WASM path: Decode then encode
    const imageData = await decodeFile(inputPath);
    const encodeOptions = { ...(encoder.defaultOptions as Record<string, unknown>), quality };
    encoded = await encoder.encode(imageData, encodeOptions);
  }

  // 3. Write output
  const outputPath = await writeOutputFile(
    inputPath,
    encoded,
    encoder.extension,
    outputOptions
  );

  // 4. Delete original if requested and output path differs from input
  if (replaceOriginal && outputPath !== inputPath) {
    await unlink(inputPath);
  }

  return {
    inputPath,
    outputPath,
    originalSize,
    compressedSize: encoded.byteLength,
    success: true,
  };
}

/**
 * Reports the results of batch processing
 * @param results - Array of processing results
 */
function reportResults(results: ProcessResult[]): void {
  // Show summary: files processed, total size saved, any errors
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(chalk.bold('\n  Results:\n'));

  if (successful.length > 0) {
    const totalOriginal = successful.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = successful.reduce((sum, r) => sum + (r.compressedSize ?? 0), 0);
    const saved = totalOriginal - totalCompressed;
    const percent = totalOriginal > 0 ? ((saved / totalOriginal) * 100).toFixed(1) : '0.0';

    console.log(chalk.green(`  \u2713 ${successful.length} file(s) processed successfully`));
    console.log(chalk.gray(`    Original:   ${formatBytes(totalOriginal)}`));
    console.log(chalk.gray(`    Compressed: ${formatBytes(totalCompressed)}`));
    console.log(chalk.cyan(`    Saved:      ${formatBytes(saved)} (${percent}%)\n`));
  }

  if (failed.length > 0) {
    console.log(chalk.red(`  \u2717 ${failed.length} file(s) failed:\n`));
    for (const f of failed) {
      console.log(chalk.red(`    - ${basename(f.inputPath)}: ${f.error}`));
    }
    console.log('');
  }
}

// Re-export scanner utilities
export { scanFiles, parseExtensions, DEFAULT_EXTENSIONS } from './scanner.js';
