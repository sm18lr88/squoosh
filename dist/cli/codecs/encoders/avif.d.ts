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
 * AVIF tuning options
 */
export declare enum AVIFTune {
    auto = 0,
    psnr = 1,
    ssim = 2
}
/**
 * AVIF encoding options
 */
export interface EncodeOptions {
    quality: number;
    qualityAlpha: number;
    denoiseLevel: number;
    tileColsLog2: number;
    tileRowsLog2: number;
    speed: number;
    subsample: number;
    chromaDeltaQ: boolean;
    sharpness: number;
    tune: AVIFTune;
    enableSharpYUV: boolean;
}
export declare const label = "AVIF";
export declare const mimeType = "image/avif";
export declare const extension = "avif";
export declare const defaultOptions: EncodeOptions;
/**
 * Pre-warm the WASM module for faster first encode
 */
export declare function warmup(): Promise<void>;
export declare function encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer>;
//# sourceMappingURL=avif.d.ts.map