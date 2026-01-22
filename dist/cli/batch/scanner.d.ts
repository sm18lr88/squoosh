/**
 * File scanner for batch processing
 * Scans directories for image files based on extension filters
 */
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
export declare function scanFiles(input: string, options: ScanOptions): Promise<string[]>;
/**
 * Parses a comma-separated string of file extensions
 * @param extString - Comma-separated extensions (e.g., "jpg,png,webp" or ".jpg,.png,.webp")
 * @returns Array of normalized extensions without leading dots
 */
export declare function parseExtensions(extString: string): string[];
/**
 * Default image extensions supported for batch processing
 */
export declare const DEFAULT_EXTENSIONS: string[];
//# sourceMappingURL=scanner.d.ts.map