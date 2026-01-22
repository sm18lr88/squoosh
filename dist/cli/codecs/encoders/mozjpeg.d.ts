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
 * MozJPEG color space options
 */
export declare enum MozJpegColorSpace {
    GRAYSCALE = 1,
    RGB = 2,
    YCbCr = 3
}
/**
 * MozJPEG encoding options
 */
export interface EncodeOptions {
    quality: number;
    baseline: boolean;
    arithmetic: boolean;
    progressive: boolean;
    optimize_coding: boolean;
    smoothing: number;
    color_space: MozJpegColorSpace;
    quant_table: number;
    trellis_multipass: boolean;
    trellis_opt_zero: boolean;
    trellis_opt_table: boolean;
    trellis_loops: number;
    auto_subsample: boolean;
    chroma_subsample: number;
    separate_chroma_quality: boolean;
    chroma_quality: number;
}
export declare const label = "MozJPEG";
export declare const mimeType = "image/jpeg";
export declare const extension = "jpg";
export declare const defaultOptions: EncodeOptions;
/**
 * Pre-warm the WASM module for faster first encode
 */
export declare function warmup(): Promise<void>;
export declare function encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer>;
//# sourceMappingURL=mozjpeg.d.ts.map