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
 * QOI encoding options
 * QOI is a lossless format with minimal options
 */
export type EncodeOptions = Record<string, never>;
export declare const label = "QOI";
export declare const mimeType = "image/qoi";
export declare const extension = "qoi";
export declare const defaultOptions: EncodeOptions;
/**
 * Pre-warm the WASM module for faster first encode
 */
export declare function warmup(): Promise<void>;
export declare function encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer>;
//# sourceMappingURL=qoi.d.ts.map