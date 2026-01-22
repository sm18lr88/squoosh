/**
 * Batch processing module for Squoosh CLI
 * Handles compression of multiple image files with progress reporting
 * Supports parallel processing for improved performance
 */
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
 * Runs the compress command on the specified input
 * @param input - Path to file or directory to process
 * @param options - Compression options
 */
export declare function runCompress(input: string, options: CompressOptions): Promise<void>;
export { scanFiles, parseExtensions, DEFAULT_EXTENSIONS } from './scanner.js';
//# sourceMappingURL=index.d.ts.map