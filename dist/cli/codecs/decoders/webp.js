/**
 * WebP decoder adapter for Node.js CLI
 * Uses WebP WASM decoder
 */
// Ensure ImageData polyfill is available
import '../../utils/image-data.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
let modulePromise;
async function initModule() {
    const module = await import('../../../../codecs/webp/dec/webp_node_dec.js');
    // Get the path to the WASM file and read it directly
    // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
    const wasmPath = join(dirname(fileURLToPath(import.meta.url)), '../../../../codecs/webp/dec/webp_node_dec.wasm');
    const wasmBinary = await readFile(wasmPath);
    // Initialize with wasmBinary to avoid fetch
    const factory = module.default;
    return factory({
        wasmBinary: wasmBinary.buffer,
    });
}
export async function decode(data) {
    if (!modulePromise) {
        modulePromise = initModule();
    }
    const module = await modulePromise;
    const result = module.decode(data);
    if (!result) {
        throw new Error('WebP decoding failed');
    }
    return result;
}
