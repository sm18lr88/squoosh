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
/**
 * MozJPEG color space options
 */
export var MozJpegColorSpace;
(function (MozJpegColorSpace) {
    MozJpegColorSpace[MozJpegColorSpace["GRAYSCALE"] = 1] = "GRAYSCALE";
    MozJpegColorSpace[MozJpegColorSpace["RGB"] = 2] = "RGB";
    MozJpegColorSpace[MozJpegColorSpace["YCbCr"] = 3] = "YCbCr";
})(MozJpegColorSpace || (MozJpegColorSpace = {}));
export const label = 'MozJPEG';
export const mimeType = 'image/jpeg';
export const extension = 'jpg';
export const defaultOptions = {
    quality: 75,
    baseline: false,
    arithmetic: false,
    progressive: true,
    optimize_coding: true,
    smoothing: 0,
    color_space: MozJpegColorSpace.YCbCr,
    quant_table: 3,
    trellis_multipass: false,
    trellis_opt_zero: false,
    trellis_opt_table: false,
    trellis_loops: 1,
    auto_subsample: true,
    chroma_subsample: 2,
    separate_chroma_quality: false,
    chroma_quality: 75,
};
let modulePromise;
async function initModule() {
    const mozjpegModule = await import('../../../../codecs/mozjpeg/enc/mozjpeg_node_enc.js');
    // Get the path to the WASM file and read it directly
    // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
    const wasmPath = join(dirname(fileURLToPath(import.meta.url)), '../../../../codecs/mozjpeg/enc/mozjpeg_node_enc.wasm');
    const wasmBinary = await readFile(wasmPath);
    // Initialize with wasmBinary to avoid fetch
    const factory = mozjpegModule.default;
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
        throw new Error('MozJPEG encoding error');
    }
    return result.buffer;
}
