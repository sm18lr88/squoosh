/**
 * Output file utilities for the Squoosh CLI
 * Handles writing output files with proper directory structure
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, basename, extname, relative, isAbsolute } from 'node:path';

/**
 * Options for output file handling
 */
export interface OutputOptions {
  /** Directory to write output files to (defaults to same directory as input) */
  outputDir?: string;
  /** Whether to preserve the input directory structure in output */
  preserveStructure?: boolean;
  /** Base directory for input files (used with preserveStructure) */
  inputBaseDir?: string;
  /** Suffix to add before the extension (e.g., ".min" for "image.min.webp") */
  suffix?: string;
}

/**
 * Gets the output filename with the new extension
 * @param inputPath - The input file path
 * @param newExtension - The new extension (with or without leading dot)
 * @param suffix - Optional suffix to add before extension
 * @returns The new filename
 */
function getOutputFilename(
  inputPath: string,
  newExtension: string,
  suffix?: string,
): string {
  const inputBasename = basename(inputPath);
  const inputExt = extname(inputBasename);
  const nameWithoutExt = inputBasename.slice(
    0,
    inputBasename.length - inputExt.length,
  );

  // Ensure extension starts with a dot
  const ext = newExtension.startsWith('.') ? newExtension : `.${newExtension}`;

  // Add suffix if provided
  const suffixStr = suffix ?? '';

  return `${nameWithoutExt}${suffixStr}${ext}`;
}

/**
 * Calculates the output path for a file without writing it
 * @param inputPath - The path to the input file
 * @param newExtension - The new file extension (e.g., "webp", ".webp")
 * @param options - Output options
 * @returns The calculated output path
 */
export function getOutputPath(
  inputPath: string,
  newExtension: string,
  options: OutputOptions = {},
): string {
  const { outputDir, preserveStructure = false, inputBaseDir, suffix } = options;

  const outputFilename = getOutputFilename(inputPath, newExtension, suffix);

  // If no output directory specified, write next to input file
  if (!outputDir) {
    return join(dirname(inputPath), outputFilename);
  }

  // If preserveStructure is true and we have a base directory,
  // maintain the relative path structure
  if (preserveStructure && inputBaseDir) {
    const inputDir = dirname(inputPath);
    const relativeDir = relative(inputBaseDir, inputDir);

    // Handle case where input is outside the base directory
    if (relativeDir.startsWith('..') || isAbsolute(relativeDir)) {
      // Fall back to flat output
      return join(outputDir, outputFilename);
    }

    return join(outputDir, relativeDir, outputFilename);
  }

  // Default: write directly to output directory
  return join(outputDir, outputFilename);
}

/**
 * Writes data to an output file, creating directories as needed
 * @param inputPath - The path to the input file
 * @param data - The data to write (ArrayBuffer or Buffer)
 * @param newExtension - The new file extension (e.g., "webp", ".webp")
 * @param options - Output options
 * @returns The path where the file was written
 */
export async function writeOutputFile(
  inputPath: string,
  data: ArrayBuffer | Buffer,
  newExtension: string,
  options: OutputOptions = {},
): Promise<string> {
  const outputPath = getOutputPath(inputPath, newExtension, options);

  // Ensure the output directory exists
  const outputDirPath = dirname(outputPath);
  await mkdir(outputDirPath, { recursive: true });

  // Convert ArrayBuffer to Buffer if needed
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

  // Write the file
  await writeFile(outputPath, buffer);

  return outputPath;
}

/**
 * Ensures a directory exists, creating it if necessary
 * @param dirPath - The directory path to ensure
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Gets a unique output path by adding a number suffix if file exists
 * @param basePath - The base output path
 * @returns A unique path (may have number suffix like "image_1.webp")
 */
export function makeUniquePath(basePath: string, existingPaths: Set<string>): string {
  if (!existingPaths.has(basePath)) {
    return basePath;
  }

  const dir = dirname(basePath);
  const ext = extname(basePath);
  const nameWithoutExt = basename(basePath, ext);

  let counter = 1;
  let uniquePath: string;

  do {
    uniquePath = join(dir, `${nameWithoutExt}_${counter}${ext}`);
    counter++;
  } while (existingPaths.has(uniquePath));

  return uniquePath;
}

/**
 * Replaces the extension of a file path
 * @param filePath - The original file path
 * @param newExtension - The new extension (with or without leading dot)
 * @returns The file path with the new extension
 */
export function replaceExtension(filePath: string, newExtension: string): string {
  const ext = newExtension.startsWith('.') ? newExtension : `.${newExtension}`;
  const currentExt = extname(filePath);
  return filePath.slice(0, filePath.length - currentExt.length) + ext;
}
