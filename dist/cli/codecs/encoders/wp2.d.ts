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
import '../../utils/image-data.js';
/**
 * WebP v2 UV mode options
 */
export declare enum UVMode {
    UVModeAuto = 0,
    UVModeAdapt = 1,
    UVMode420 = 2,
    UVMode444 = 3
}
/**
 * WebP v2 color space type options
 */
export declare enum Csp {
    kYCoCg = 0,
    kYCbCr = 1,
    kCustom = 2,
    kYIQ = 3
}
/**
 * WebP v2 encoding options
 */
export interface EncodeOptions {
    quality: number;
    alpha_quality: number;
    effort: number;
    pass: number;
    sns: number;
    uv_mode: UVMode;
    csp_type: Csp;
    error_diffusion: number;
    use_random_matrix: boolean;
}
export declare const label = "WebP v2 (unstable)";
export declare const mimeType = "image/webp2";
export declare const extension = "wp2";
export declare const defaultOptions: EncodeOptions;
/**
 * Pre-warm the WASM module for faster first encode
 */
export declare function warmup(): Promise<void>;
export declare function encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer>;
//# sourceMappingURL=wp2.d.ts.map