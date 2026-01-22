/**
 * PNG decoder adapter for Node.js CLI
 * Uses Rust WASM decoder (squoosh_png)
 */
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Ensure ImageData polyfill is available
import '../../utils/image-data.js';
let modulePromise;
async function initModule() {
    // The PNG codec uses wasm-bindgen which requires init() to be called
    const pngModule = await import('../../../../codecs/png/pkg/squoosh_png.js');
    // Get the path to the WASM file
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFile);
    const wasmPath = join(currentDir, '../../../../codecs/png/pkg/squoosh_png_bg.wasm');
    // Read the WASM file and initialize
    const wasmBuffer = await readFile(wasmPath);
    const init = pngModule.default;
    await init(wasmBuffer);
    return {
        decode: pngModule.decode,
    };
}
export async function decode(data) {
    if (!modulePromise) {
        modulePromise = initModule();
    }
    const module = await modulePromise;
    const result = module.decode(data);
    if (!result) {
        throw new Error('PNG decoding failed');
    }
    return result;
}
