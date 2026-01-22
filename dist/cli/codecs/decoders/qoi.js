/**
 * QOI decoder adapter for Node.js CLI
 * Uses QOI WASM decoder
 *
 * Note: QOI doesn't have a dedicated Node.js decoder, so we use the
 * worker version which works in Node.js environments.
 */
// Ensure ImageData polyfill is available
import '../../utils/image-data.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
let modulePromise;
async function initModule() {
    const module = await import('../../../../codecs/qoi/dec/qoi_dec.js');
    // Get the path to the WASM file and read it directly
    // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
    const wasmPath = join(dirname(fileURLToPath(import.meta.url)), '../../../../codecs/qoi/dec/qoi_dec.wasm');
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
        throw new Error('QOI decoding failed');
    }
    return result;
}
