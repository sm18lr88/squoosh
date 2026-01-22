/**
 * Progress utilities for CLI output
 * Uses ora spinner for visual feedback during long-running operations
 */
import ora from 'ora';
/**
 * Creates a new ora spinner with the given text
 * @param text - The initial text to display
 * @returns An ora spinner instance
 */
export function createSpinner(text) {
    return ora({
        text,
        spinner: 'dots',
    });
}
/**
 * Formats bytes to a human-readable string
 * @param bytes - The number of bytes
 * @returns A formatted string like "1.5 MB" or "256 KB"
 */
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const negative = bytes < 0;
    const absBytes = Math.abs(bytes);
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const base = 1024;
    // Find the appropriate unit
    const exponent = Math.min(Math.floor(Math.log(absBytes) / Math.log(base)), units.length - 1);
    const value = absBytes / Math.pow(base, exponent);
    // Format with appropriate precision
    let formatted;
    if (exponent === 0) {
        // Bytes - no decimal places
        formatted = value.toFixed(0);
    }
    else if (value >= 100) {
        // Large values - no decimal places
        formatted = value.toFixed(0);
    }
    else if (value >= 10) {
        // Medium values - 1 decimal place
        formatted = value.toFixed(1);
    }
    else {
        // Small values - 2 decimal places
        formatted = value.toFixed(2);
    }
    return `${negative ? '-' : ''}${formatted} ${units[exponent]}`;
}
/**
 * Formats a value as a percentage of a total
 * @param value - The current value
 * @param total - The total value
 * @returns A formatted percentage string like "75.5%"
 */
export function formatPercent(value, total) {
    if (total === 0)
        return '0%';
    const percent = (value / total) * 100;
    return `${percent.toFixed(1)}%`;
}
/**
 * Formats the size difference between two values
 * @param original - The original size in bytes
 * @param compressed - The compressed size in bytes
 * @returns A formatted string showing the difference and percentage
 */
export function formatSizeDiff(original, compressed) {
    const diff = compressed - original;
    const percent = ((diff / original) * 100).toFixed(1);
    const sign = diff > 0 ? '+' : '';
    return `${sign}${formatBytes(diff)} (${sign}${percent}%)`;
}
/**
 * Creates a progress reporter that shows current/total with percentage
 * @param label - The label to show before the progress
 * @returns A ProgressReporter instance
 */
export function createProgressReporter(label) {
    let spinner = null;
    let total = 0;
    return {
        start(count) {
            total = count;
            spinner = ora({
                text: `${label} [0/${total}] 0%`,
                spinner: 'dots',
            }).start();
        },
        update(current, message) {
            if (!spinner)
                return;
            const percent = total > 0 ? ((current / total) * 100).toFixed(0) : '0';
            let text = `${label} [${current}/${total}] ${percent}%`;
            if (message) {
                text += ` - ${message}`;
            }
            spinner.text = text;
        },
        succeed(message) {
            if (spinner) {
                spinner.succeed(message);
                spinner = null;
            }
        },
        fail(message) {
            if (spinner) {
                spinner.fail(message);
                spinner = null;
            }
        },
        stop() {
            if (spinner) {
                spinner.stop();
                spinner = null;
            }
        },
    };
}
/**
 * Creates a simple spinner for single operations
 * @param text - The text to display
 * @returns Object with start, succeed, fail, and stop methods
 */
export function createSimpleSpinner(text) {
    const spinner = ora({
        text,
        spinner: 'dots',
    });
    return {
        start: () => spinner.start(),
        succeed: (message) => spinner.succeed(message),
        fail: (message) => spinner.fail(message),
        stop: () => spinner.stop(),
        update: (newText) => {
            spinner.text = newText;
        },
    };
}
