/**
 * Output file utilities for the Squoosh CLI
 * Handles writing output files with proper directory structure
 */
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
 * Calculates the output path for a file without writing it
 * @param inputPath - The path to the input file
 * @param newExtension - The new file extension (e.g., "webp", ".webp")
 * @param options - Output options
 * @returns The calculated output path
 */
export declare function getOutputPath(inputPath: string, newExtension: string, options?: OutputOptions): string;
/**
 * Writes data to an output file, creating directories as needed
 * @param inputPath - The path to the input file
 * @param data - The data to write (ArrayBuffer or Buffer)
 * @param newExtension - The new file extension (e.g., "webp", ".webp")
 * @param options - Output options
 * @returns The path where the file was written
 */
export declare function writeOutputFile(inputPath: string, data: ArrayBuffer | Buffer, newExtension: string, options?: OutputOptions): Promise<string>;
/**
 * Ensures a directory exists, creating it if necessary
 * @param dirPath - The directory path to ensure
 */
export declare function ensureDir(dirPath: string): Promise<void>;
/**
 * Gets a unique output path by adding a number suffix if file exists
 * @param basePath - The base output path
 * @returns A unique path (may have number suffix like "image_1.webp")
 */
export declare function makeUniquePath(basePath: string, existingPaths: Set<string>): string;
/**
 * Replaces the extension of a file path
 * @param filePath - The original file path
 * @param newExtension - The new extension (with or without leading dot)
 * @returns The file path with the new extension
 */
export declare function replaceExtension(filePath: string, newExtension: string): string;
//# sourceMappingURL=output.d.ts.map