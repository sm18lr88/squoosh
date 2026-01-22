/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Interactive mode for Squoosh CLI
 * Guides users through image compression with prompts
 */

import chalk from 'chalk';
import { stat, readdir } from 'node:fs/promises';
import { join, dirname, extname, basename, resolve } from 'node:path';
import { glob } from 'glob';
import {
  promptInputType,
  promptFormat,
  promptQuality,
  promptOutputDir,
  confirmSettings,
  type InputSelection,
  type FormatSelection,
  type QualityOptions,
} from './prompts.js';
import { decodeFile, getSupportedExtensions } from '../codecs/decoders/index.js';
import {
  createProgressReporter,
  formatBytes,
  formatSizeDiff,
} from '../utils/progress.js';
import { writeOutputFile, type OutputOptions } from '../utils/output.js';

/**
 * Result of processing a single file
 */
interface ProcessResult {
  inputPath: string;
  outputPath: string;
  inputSize: number;
  outputSize: number;
  success: boolean;
  error?: string;
}

/**
 * Run the interactive mode
 */
export async function runInteractive(): Promise<void> {
  console.log(chalk.bold('\n  Interactive Mode\n'));
  console.log(chalk.gray('  Answer the prompts to compress your images.\n'));

  try {
    // Step 1: Select input
    const input = await promptInputType();

    // Step 2: Collect files
    const files = await collectFiles(input);

    if (files.length === 0) {
      console.log(chalk.yellow('\n  No files found matching the criteria.\n'));
      return;
    }

    console.log(chalk.cyan(`\n  Found ${files.length} file(s) to process.\n`));

    // Step 3: Select format
    const format = await promptFormat();

    // Step 4: Configure quality
    const quality = await promptQuality(format.encoder);

    // Step 5: Select output directory
    const defaultOutputDir = dirname(resolve(files[0]));
    const outputDir = await promptOutputDir(defaultOutputDir);

    // Step 6: Confirm
    const confirmed = await confirmSettings({
      input,
      format,
      quality,
      outputDir,
      fileCount: files.length,
    });

    if (!confirmed) {
      console.log(chalk.yellow('\n  Cancelled.\n'));
      return;
    }

    // Step 7: Process files
    await processFiles(files, format, quality, outputDir);
  } catch (error) {
    if ((error as { name?: string }).name === 'ExitPromptError') {
      // User pressed Ctrl+C
      console.log(chalk.yellow('\n  Cancelled.\n'));
      return;
    }
    throw error;
  }
}

/**
 * Collect files based on input selection
 */
async function collectFiles(input: InputSelection): Promise<string[]> {
  const files: string[] = [];

  if (input.inputType === 'file' || input.inputType === 'files') {
    // Validate each file exists and is a supported format
    for (const filePath of input.paths) {
      const resolvedPath = resolve(filePath);
      try {
        const fileStat = await stat(resolvedPath);
        if (!fileStat.isFile()) {
          console.log(chalk.yellow(`  Warning: ${filePath} is not a file, skipping.`));
          continue;
        }

        const ext = extname(resolvedPath).toLowerCase();
        const supportedExtensions = getSupportedExtensions();
        if (!supportedExtensions.includes(ext)) {
          console.log(
            chalk.yellow(
              `  Warning: ${filePath} has unsupported format ${ext}, skipping.`,
            ),
          );
          continue;
        }

        files.push(resolvedPath);
      } catch {
        console.log(chalk.yellow(`  Warning: ${filePath} not found, skipping.`));
      }
    }
  } else {
    // Folder scanning
    const folderPath = resolve(input.paths[0]);

    try {
      const folderStat = await stat(folderPath);
      if (!folderStat.isDirectory()) {
        console.log(chalk.red(`  Error: ${folderPath} is not a directory.`));
        return [];
      }
    } catch {
      console.log(chalk.red(`  Error: ${folderPath} not found.`));
      return [];
    }

    const extensions = input.extensions || getSupportedExtensions();

    if (input.recursive) {
      // Use glob for recursive search
      for (const ext of extensions) {
        const pattern = `**/*${ext}`;
        const matches = await glob(pattern, {
          cwd: folderPath,
          nodir: true,
          absolute: true,
        });
        files.push(...matches);
      }
    } else {
      // Non-recursive: read directory directly
      const entries = await readdir(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(join(folderPath, entry.name));
          }
        }
      }
    }
  }

  // Remove duplicates and sort
  const uniqueFiles = [...new Set(files)].sort();
  return uniqueFiles;
}

/**
 * Process files with the selected encoder
 */
async function processFiles(
  files: string[],
  format: FormatSelection,
  quality: QualityOptions,
  outputDir: string,
): Promise<void> {
  const results: ProcessResult[] = [];
  const progress = createProgressReporter('Processing');

  console.log('');
  progress.start(files.length);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = basename(filePath);

    progress.update(i, fileName);

    try {
      // Get input file size
      const inputStat = await stat(filePath);
      const inputSize = inputStat.size;

      // Decode the image
      const imageData = await decodeFile(filePath);

      // Prepare encoder options with quality
      const encoderOptions = {
        ...(format.encoder.defaultOptions as Record<string, unknown>),
        quality: quality.quality,
      };

      // Encode to target format
      const encoded = await format.encoder.encode(imageData, encoderOptions);

      // Determine output options
      const outputOptions: OutputOptions = {};

      // If outputDir differs from input file's directory, use it
      const inputDir = dirname(filePath);
      if (resolve(outputDir) !== resolve(inputDir)) {
        outputOptions.outputDir = outputDir;
      }

      // Write output file
      const outputPath = await writeOutputFile(
        filePath,
        encoded,
        format.encoder.extension,
        outputOptions,
      );

      // Get output file size
      const outputStat = await stat(outputPath);
      const outputSize = outputStat.size;

      results.push({
        inputPath: filePath,
        outputPath,
        inputSize,
        outputSize,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        inputPath: filePath,
        outputPath: '',
        inputSize: 0,
        outputSize: 0,
        success: false,
        error: errorMessage,
      });
    }
  }

  // Complete progress
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  if (failCount === 0) {
    progress.succeed(`Processed ${successCount} file(s) successfully`);
  } else if (successCount === 0) {
    progress.fail(`Failed to process all ${failCount} file(s)`);
  } else {
    progress.succeed(
      `Processed ${successCount} file(s), ${failCount} failed`,
    );
  }

  // Show summary
  printSummary(results);
}

/**
 * Print processing summary
 */
function printSummary(results: ProcessResult[]): void {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length > 0) {
    console.log(chalk.bold('\n  Results:\n'));

    let totalInputSize = 0;
    let totalOutputSize = 0;

    for (const result of successful) {
      totalInputSize += result.inputSize;
      totalOutputSize += result.outputSize;

      const inputName = basename(result.inputPath);
      const outputName = basename(result.outputPath);
      const sizeDiff = formatSizeDiff(result.inputSize, result.outputSize);
      const diffColor = result.outputSize <= result.inputSize ? chalk.green : chalk.red;

      console.log(
        `  ${chalk.gray(inputName)} -> ${chalk.cyan(outputName)}  ${diffColor(sizeDiff)}`,
      );
    }

    // Total savings
    if (successful.length > 1) {
      const totalDiff = formatSizeDiff(totalInputSize, totalOutputSize);
      const totalDiffColor = totalOutputSize <= totalInputSize ? chalk.green : chalk.red;

      console.log(chalk.bold('\n  Total:'));
      console.log(
        `  ${formatBytes(totalInputSize)} -> ${formatBytes(totalOutputSize)}  ${totalDiffColor(totalDiff)}`,
      );
    }
  }

  if (failed.length > 0) {
    console.log(chalk.bold.red('\n  Errors:\n'));

    for (const result of failed) {
      const inputName = basename(result.inputPath);
      console.log(`  ${chalk.red('x')} ${inputName}: ${result.error}`);
    }
  }

  console.log('');
}

export {
  type InputSelection,
  type FormatSelection,
  type QualityOptions,
} from './prompts.js';
