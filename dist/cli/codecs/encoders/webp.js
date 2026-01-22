/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Ensure ImageData polyfill is available
import '../../utils/image-data.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
export const label = 'WebP';
export const mimeType = 'image/webp';
export const extension = 'webp';
export const defaultOptions = {
    quality: 75,
    target_size: 0,
    target_PSNR: 0,
    method: 4,
    sns_strength: 50,
    filter_strength: 60,
    filter_sharpness: 0,
    filter_type: 1,
    partitions: 0,
    segments: 4,
    pass: 1,
    show_compressed: 0,
    preprocessing: 0,
    autofilter: 0,
    partition_limit: 0,
    alpha_compression: 1,
    alpha_filtering: 1,
    alpha_quality: 100,
    lossless: 0,
    exact: 0,
    image_hint: 0,
    emulate_jpeg_size: 0,
    thread_level: 0,
    low_memory: 0,
    near_lossless: 100,
    use_delta_palette: 0,
    use_sharp_yuv: 0,
};
let modulePromise;
async function initModule() {
    const webpModule = await import('../../../../codecs/webp/enc/webp_node_enc.js');
    // Get the path to the WASM file and read it directly
    // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
    const wasmPath = join(dirname(fileURLToPath(import.meta.url)), '../../../../codecs/webp/enc/webp_node_enc.wasm');
    const wasmBinary = await readFile(wasmPath);
    // Initialize with wasmBinary to avoid fetch
    const factory = webpModule.default;
    return factory({
        wasmBinary: wasmBinary.buffer,
    });
}
/**
 * Pre-warm the WASM module for faster first encode
 */
export async function warmup() {
    if (!modulePromise) {
        modulePromise = initModule();
    }
    await modulePromise;
}
export async function encode(data, options) {
    if (!modulePromise) {
        modulePromise = initModule();
    }
    const module = await modulePromise;
    const result = module.encode(data.data, data.width, data.height, options);
    if (!result) {
        throw new Error('WebP encoding error');
    }
    return result.buffer;
}
