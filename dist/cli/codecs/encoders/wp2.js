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
 * WebP v2 UV mode options
 */
export var UVMode;
(function (UVMode) {
    UVMode[UVMode["UVModeAuto"] = 0] = "UVModeAuto";
    UVMode[UVMode["UVModeAdapt"] = 1] = "UVModeAdapt";
    UVMode[UVMode["UVMode420"] = 2] = "UVMode420";
    UVMode[UVMode["UVMode444"] = 3] = "UVMode444";
})(UVMode || (UVMode = {}));
/**
 * WebP v2 color space type options
 */
export var Csp;
(function (Csp) {
    Csp[Csp["kYCoCg"] = 0] = "kYCoCg";
    Csp[Csp["kYCbCr"] = 1] = "kYCbCr";
    Csp[Csp["kCustom"] = 2] = "kCustom";
    Csp[Csp["kYIQ"] = 3] = "kYIQ";
})(Csp || (Csp = {}));
export const label = 'WebP v2 (unstable)';
export const mimeType = 'image/webp2';
export const extension = 'wp2';
export const defaultOptions = {
    quality: 75,
    alpha_quality: 75,
    effort: 5,
    pass: 1,
    sns: 50,
    uv_mode: UVMode.UVModeAuto,
    csp_type: Csp.kYCoCg,
    error_diffusion: 0,
    use_random_matrix: false,
};
let modulePromise;
async function initModule() {
    const wp2Module = await import('../../../../codecs/wp2/enc/wp2_node_enc.js');
    // Get the path to the WASM file and read it directly
    // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
    const wasmPath = join(dirname(fileURLToPath(import.meta.url)), '../../../../codecs/wp2/enc/wp2_node_enc.wasm');
    const wasmBinary = await readFile(wasmPath);
    // Initialize with wasmBinary to avoid fetch
    const factory = wp2Module.default;
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
        throw new Error('WebP v2 encoding error');
    }
    return result.buffer;
}
