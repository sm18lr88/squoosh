/**
 * Progress utilities for CLI output
 * Uses ora spinner for visual feedback during long-running operations
 */
import { Ora } from 'ora';
/**
 * Creates a new ora spinner with the given text
 * @param text - The initial text to display
 * @returns An ora spinner instance
 */
export declare function createSpinner(text: string): Ora;
/**
 * Formats bytes to a human-readable string
 * @param bytes - The number of bytes
 * @returns A formatted string like "1.5 MB" or "256 KB"
 */
export declare function formatBytes(bytes: number): string;
/**
 * Formats a value as a percentage of a total
 * @param value - The current value
 * @param total - The total value
 * @returns A formatted percentage string like "75.5%"
 */
export declare function formatPercent(value: number, total: number): string;
/**
 * Formats the size difference between two values
 * @param original - The original size in bytes
 * @param compressed - The compressed size in bytes
 * @returns A formatted string showing the difference and percentage
 */
export declare function formatSizeDiff(original: number, compressed: number): string;
/**
 * Interface for tracking and reporting progress
 */
export interface ProgressReporter {
    /** Start progress tracking with a total count */
    start(total: number): void;
    /** Update progress with current count and optional message */
    update(current: number, message?: string): void;
    /** Mark progress as successfully completed */
    succeed(message: string): void;
    /** Mark progress as failed */
    fail(message: string): void;
    /** Stop the spinner without a success/fail status */
    stop(): void;
}
/**
 * Creates a progress reporter that shows current/total with percentage
 * @param label - The label to show before the progress
 * @returns A ProgressReporter instance
 */
export declare function createProgressReporter(label: string): ProgressReporter;
/**
 * Creates a simple spinner for single operations
 * @param text - The text to display
 * @returns Object with start, succeed, fail, and stop methods
 */
export declare function createSimpleSpinner(text: string): {
    start: () => void;
    succeed: (message?: string) => void;
    fail: (message?: string) => void;
    stop: () => void;
    update: (newText: string) => void;
};
//# sourceMappingURL=progress.d.ts.map