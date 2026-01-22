/**
 * Native CLI backend for image encoding
 * Uses external command-line tools for maximum performance
 * Falls back gracefully if tools aren't installed
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
const execAsync = promisify(exec);
// Registry of native CLI tools
const nativeTools = {
    cjxl: {
        name: 'JPEG XL (libjxl)',
        command: 'cjxl',
        formats: ['jxl'],
        checkCommand: 'cjxl --version',
        available: null,
    },
    cwebp: {
        name: 'WebP (libwebp)',
        command: 'cwebp',
        formats: ['webp'],
        checkCommand: 'cwebp -version',
        available: null,
    },
    avifenc: {
        name: 'AVIF (libavif)',
        command: 'avifenc',
        formats: ['avif'],
        checkCommand: 'avifenc --version',
        available: null,
    },
    cjpegli: {
        name: 'JPEG (jpegli)',
        command: 'cjpegli',
        formats: ['jpg', 'jpeg'],
        checkCommand: 'cjpegli --version',
        available: null,
    },
};
/**
 * Check if a native tool is available
 */
async function checkToolAvailable(tool) {
    if (tool.available !== null) {
        return tool.available;
    }
    try {
        await execAsync(tool.checkCommand);
        tool.available = true;
        return true;
    }
    catch {
        tool.available = false;
        return false;
    }
}
/**
 * Check which native tools are available
 */
export async function checkNativeTools() {
    const results = {};
    await Promise.all(Object.entries(nativeTools).map(async ([key, tool]) => {
        results[key] = await checkToolAvailable(tool);
    }));
    return results;
}
/**
 * Get the best available tool for a format
 */
export async function getBestToolForFormat(format) {
    for (const tool of Object.values(nativeTools)) {
        if (tool.formats.includes(format) && await checkToolAvailable(tool)) {
            return tool;
        }
    }
    return null;
}
/**
 * Check if native encoding is available for a format
 */
export async function isNativeAvailable(format) {
    return (await getBestToolForFormat(format)) !== null;
}
/**
 * Encode using native CLI tool (for formats not supported by Sharp)
 * @param inputPath - Input image file path
 * @param format - Output format
 * @param quality - Quality 0-100
 * @returns Encoded image as ArrayBuffer
 */
export async function encodeWithNative(inputPath, format, quality = 75) {
    const tool = await getBestToolForFormat(format);
    if (!tool) {
        throw new Error(`No native tool available for format: ${format}`);
    }
    const tempOutput = join(tmpdir(), `squoosh-${randomUUID()}.${format}`);
    try {
        let command;
        switch (tool.command) {
            case 'cjxl':
                // cjxl input.png output.jxl -q 75
                command = `cjxl "${inputPath}" "${tempOutput}" -q ${quality} --effort 7`;
                break;
            case 'cwebp':
                // cwebp -q 75 input.png -o output.webp
                command = `cwebp -q ${quality} "${inputPath}" -o "${tempOutput}"`;
                break;
            case 'avifenc': {
                // avifenc --min 0 --max 63 -a cq-level=30 input.png output.avif
                const cqLevel = Math.round((100 - quality) * 0.63);
                command = `avifenc --min 0 --max 63 -a cq-level=${cqLevel} "${inputPath}" "${tempOutput}"`;
                break;
            }
            case 'cjpegli':
                // cjpegli input.png output.jpg -q 75
                command = `cjpegli "${inputPath}" "${tempOutput}" -q ${quality}`;
                break;
            default:
                throw new Error(`Unknown tool: ${tool.command}`);
        }
        await execAsync(command, { timeout: 300000 }); // 5 minute timeout
        const buffer = await readFile(tempOutput);
        const arrayBuffer = new ArrayBuffer(buffer.byteLength);
        new Uint8Array(arrayBuffer).set(buffer);
        return arrayBuffer;
    }
    finally {
        // Clean up temp file
        try {
            await unlink(tempOutput);
        }
        catch {
            // Ignore cleanup errors
        }
    }
}
/**
 * Process file end-to-end with native tool
 * More efficient than encoding from ImageData
 */
export async function processWithNative(inputPath, format, quality = 75) {
    return encodeWithNative(inputPath, format, quality);
}
/**
 * Get optimal concurrency for different backends
 */
export function getOptimalConcurrency(backend, cpuCount) {
    switch (backend) {
        case 'sharp':
            // Sharp/libvips handles its own threading efficiently
            // Use CPU count but cap at reasonable level
            return Math.min(cpuCount, 16);
        case 'native':
            // Native tools often use multiple threads internally
            // Lower concurrency to avoid oversubscription
            return Math.max(2, Math.floor(cpuCount / 2));
        case 'wasm':
            // WASM is single-threaded per call
            // Higher concurrency helps with I/O overlap but too much causes contention
            return Math.min(4, cpuCount);
        default:
            return Math.min(4, cpuCount);
    }
}
