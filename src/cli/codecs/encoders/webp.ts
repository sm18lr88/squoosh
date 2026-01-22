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

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

/**
 * WebP encoding options
 * These come from struct WebPConfig in encode.h
 */
export interface EncodeOptions {
  quality: number;
  target_size: number;
  target_PSNR: number;
  method: number;
  sns_strength: number;
  filter_strength: number;
  filter_sharpness: number;
  filter_type: number;
  partitions: number;
  segments: number;
  pass: number;
  show_compressed: number;
  preprocessing: number;
  autofilter: number;
  partition_limit: number;
  alpha_compression: number;
  alpha_filtering: number;
  alpha_quality: number;
  lossless: number;
  exact: number;
  image_hint: number;
  emulate_jpeg_size: number;
  thread_level: number;
  low_memory: number;
  near_lossless: number;
  use_delta_palette: number;
  use_sharp_yuv: number;
}

export const label = 'WebP';
export const mimeType = 'image/webp';
export const extension = 'webp';

export const defaultOptions: EncodeOptions = {
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

interface WebPModule {
  encode(
    data: BufferSource,
    width: number,
    height: number,
    options: EncodeOptions,
  ): Uint8Array | null;
}

let modulePromise: Promise<WebPModule>;

async function initModule(): Promise<WebPModule> {
  const webpModule = await import(
    '../../../../codecs/webp/enc/webp_node_enc.js'
  );

  // Get the path to the WASM file and read it directly
  // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../codecs/webp/enc/webp_node_enc.wasm'
  );
  const wasmBinary = await readFile(wasmPath);

  // Initialize with wasmBinary to avoid fetch
  const factory = webpModule.default as unknown as (options?: {
    wasmBinary?: ArrayBuffer;
  }) => Promise<WebPModule>;

  return factory({
    wasmBinary: wasmBinary.buffer,
  });
}

/**
 * Pre-warm the WASM module for faster first encode
 */
export async function warmup(): Promise<void> {
  if (!modulePromise) {
    modulePromise = initModule();
  }
  await modulePromise;
}

export async function encode(
  data: ImageData,
  options: EncodeOptions,
): Promise<ArrayBuffer> {
  if (!modulePromise) {
    modulePromise = initModule();
  }

  const module = await modulePromise;
  const result = module.encode(data.data, data.width, data.height, options);

  if (!result) {
    throw new Error('WebP encoding error');
  }

  return result.buffer as ArrayBuffer;
}
