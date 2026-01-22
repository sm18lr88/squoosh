/**
 * Sharp-based high-performance image encoding backend
 * Uses native libvips for significantly faster processing than WASM
 */
import sharp from 'sharp';
/**
 * Check if Sharp backend is available
 */
export function isSharpAvailable() {
    try {
        return typeof sharp === 'function';
    }
    catch {
        return false;
    }
}
/**
 * Get formats supported by Sharp
 */
export function getSharpFormats() {
    return ['webp', 'avif', 'jpeg', 'png'];
}
/**
 * Check if a format is supported by Sharp
 */
export function isFormatSupportedBySharp(format) {
    const sharpFormats = {
        webp: 'webp',
        avif: 'avif',
        mozjpeg: 'jpeg',
        jpeg: 'jpeg',
        oxipng: 'png',
        png: 'png',
    };
    return format in sharpFormats;
}
/**
 * Map CLI format names to Sharp format names
 */
function mapFormat(format) {
    const mapping = {
        webp: 'webp',
        avif: 'avif',
        mozjpeg: 'jpeg',
        jpeg: 'jpeg',
        oxipng: 'png',
        png: 'png',
    };
    return mapping[format] || 'webp';
}
/**
 * Encode ImageData using Sharp (high-performance native backend)
 * @param data - ImageData to encode
 * @param format - Output format (webp, avif, mozjpeg, oxipng)
 * @param options - Encoding options
 * @returns Encoded image as ArrayBuffer
 */
export async function encodeWithSharp(data, format, options = {}) {
    const { quality = 75, effort = 4, lossless = false } = options;
    const sharpFormat = mapFormat(format);
    // Create Sharp instance from raw RGBA data
    const image = sharp(Buffer.from(data.data.buffer), {
        raw: {
            width: data.width,
            height: data.height,
            channels: 4,
        },
    });
    // Apply format-specific encoding
    let pipeline;
    switch (sharpFormat) {
        case 'webp':
            pipeline = image.webp({
                quality,
                effort,
                lossless,
            });
            break;
        case 'avif':
            pipeline = image.avif({
                quality,
                effort,
                lossless,
            });
            break;
        case 'jpeg':
            pipeline = image.jpeg({
                quality,
                mozjpeg: true, // Use MozJPEG for better compression
            });
            break;
        case 'png':
            pipeline = image.png({
                compressionLevel: Math.min(9, Math.floor(effort * 1.5)),
                effort: Math.min(10, effort),
            });
            break;
        default:
            pipeline = image.webp({ quality });
    }
    const buffer = await pipeline.toBuffer();
    // Copy to a new ArrayBuffer to avoid SharedArrayBuffer issues
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(arrayBuffer).set(buffer);
    return arrayBuffer;
}
/**
 * Decode an image file using Sharp
 * @param filePath - Path to the image file
 * @returns ImageData-like object
 */
export async function decodeWithSharp(filePath) {
    const image = sharp(filePath);
    const { data, info } = await image
        .ensureAlpha() // Ensure RGBA
        .raw()
        .toBuffer({ resolveWithObject: true });
    // Create ImageData-compatible object
    return {
        data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        width: info.width,
        height: info.height,
        colorSpace: 'srgb',
    };
}
/**
 * Process a file end-to-end using Sharp (decode + encode)
 * This is the fastest path as it avoids ImageData conversion overhead
 * @param inputPath - Input file path
 * @param format - Output format
 * @param options - Encoding options
 * @returns Encoded image as ArrayBuffer
 */
export async function processWithSharp(inputPath, format, options = {}) {
    const { quality = 75, effort = 4, lossless = false } = options;
    const sharpFormat = mapFormat(format);
    let pipeline = sharp(inputPath);
    switch (sharpFormat) {
        case 'webp':
            pipeline = pipeline.webp({ quality, effort, lossless });
            break;
        case 'avif':
            pipeline = pipeline.avif({ quality, effort, lossless });
            break;
        case 'jpeg':
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
            break;
        case 'png':
            pipeline = pipeline.png({
                compressionLevel: Math.min(9, Math.floor(effort * 1.5)),
                effort: Math.min(10, effort),
            });
            break;
    }
    const buffer = await pipeline.toBuffer();
    // Copy to a new ArrayBuffer to avoid SharedArrayBuffer issues
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(arrayBuffer).set(buffer);
    return arrayBuffer;
}
