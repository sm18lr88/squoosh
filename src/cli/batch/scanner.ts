/**
 * File scanner for batch processing
 * Scans directories for image files based on extension filters
 */

import { stat } from 'node:fs/promises';
import { glob } from 'glob';
import { extname } from 'node:path';

/**
 * Options for file scanning
 */
export interface ScanOptions {
  /** List of allowed file extensions (without leading dot) */
  extensions: string[];
  /** Whether to scan subdirectories recursively */
  recursive: boolean;
}

/**
 * Scans input for image files matching the specified criteria
 * @param input - Path to a file or directory
 * @param options - Scan options including allowed extensions and recursion setting
 * @returns Promise resolving to array of absolute file paths
 * @throws Error if input is not a valid file or directory, or if file extension is not allowed
 */
export async function scanFiles(input: string, options: ScanOptions): Promise<string[]> {
  const inputStat = await stat(input);

  if (inputStat.isFile()) {
    // Single file - validate extension
    const ext = extname(input).toLowerCase().slice(1);
    if (options.extensions.includes(ext)) {
      return [input];
    }
    throw new Error(`File extension .${ext} not in allowed list: ${options.extensions.join(', ')}`);
  }

  if (inputStat.isDirectory()) {
    // Directory - use glob to find files
    // Note: glob brace expansion doesn't work with a single extension, so handle it specially
    const extPattern = options.extensions.length === 1
      ? options.extensions[0]
      : `{${options.extensions.join(',')}}`;
    const pattern = options.recursive
      ? `**/*.${extPattern}`
      : `*.${extPattern}`;

    return glob(pattern, {
      cwd: input,
      absolute: true,
      nocase: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
  }

  throw new Error(`Input must be a file or directory: ${input}`);
}

/**
 * Parses a comma-separated string of file extensions
 * @param extString - Comma-separated extensions (e.g., "jpg,png,webp" or ".jpg,.png,.webp")
 * @returns Array of normalized extensions without leading dots
 */
export function parseExtensions(extString: string): string[] {
  return extString.split(',').map(e => e.trim().toLowerCase().replace(/^\./, ''));
}

/**
 * Default image extensions supported for batch processing
 */
export const DEFAULT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'jxl', 'qoi', 'wp2'];
