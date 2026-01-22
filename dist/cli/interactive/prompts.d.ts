/**
 * Interactive prompt configurations for Squoosh CLI
 * Uses inquirer for user input
 */
import { type CodecInfo } from '../codecs/index.js';
/**
 * Input selection from the user
 */
export interface InputSelection {
    /** Type of input: single file, multiple files, or folder */
    inputType: 'file' | 'files' | 'folder';
    /** Array of file or folder paths */
    paths: string[];
    /** Whether to search recursively in folders */
    recursive?: boolean;
    /** File extensions to include when scanning folders */
    extensions?: string[];
}
/**
 * Format selection from the user
 */
export interface FormatSelection {
    /** Internal format name */
    format: string;
    /** Full codec info */
    encoder: CodecInfo;
}
/**
 * Quality and encoding options
 */
export interface QualityOptions {
    /** Quality level (0-100) */
    quality: number;
}
/**
 * Prompt user to select input type and paths
 */
export declare function promptInputType(): Promise<InputSelection>;
/**
 * Prompt user to select output format
 */
export declare function promptFormat(): Promise<FormatSelection>;
/**
 * Prompt user for quality settings
 */
export declare function promptQuality(encoder: CodecInfo): Promise<QualityOptions>;
/**
 * Prompt user for output directory
 */
export declare function promptOutputDir(defaultDir: string): Promise<string>;
/**
 * Confirm settings before processing
 */
export declare function confirmSettings(settings: {
    input: InputSelection;
    format: FormatSelection;
    quality: QualityOptions;
    outputDir: string;
    fileCount: number;
}): Promise<boolean>;
//# sourceMappingURL=prompts.d.ts.map