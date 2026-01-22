/**
 * Native CLI backend for image encoding
 * Uses external command-line tools for maximum performance
 * Falls back gracefully if tools aren't installed
 */
export interface NativeToolInfo {
    name: string;
    command: string;
    formats: string[];
    checkCommand: string;
    available: boolean | null;
}
/**
 * Check which native tools are available
 */
export declare function checkNativeTools(): Promise<Record<string, boolean>>;
/**
 * Get the best available tool for a format
 */
export declare function getBestToolForFormat(format: string): Promise<NativeToolInfo | null>;
/**
 * Check if native encoding is available for a format
 */
export declare function isNativeAvailable(format: string): Promise<boolean>;
/**
 * Encode using native CLI tool (for formats not supported by Sharp)
 * @param inputPath - Input image file path
 * @param format - Output format
 * @param quality - Quality 0-100
 * @returns Encoded image as ArrayBuffer
 */
export declare function encodeWithNative(inputPath: string, format: string, quality?: number): Promise<ArrayBuffer>;
/**
 * Process file end-to-end with native tool
 * More efficient than encoding from ImageData
 */
export declare function processWithNative(inputPath: string, format: string, quality?: number): Promise<ArrayBuffer>;
/**
 * Get optimal concurrency for different backends
 */
export declare function getOptimalConcurrency(backend: 'sharp' | 'native' | 'wasm', cpuCount: number): number;
//# sourceMappingURL=native-backend.d.ts.map