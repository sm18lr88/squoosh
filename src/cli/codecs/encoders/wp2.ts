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
 * WebP v2 UV mode options
 */
export enum UVMode {
  UVModeAuto = 0,
  UVModeAdapt = 1,
  UVMode420 = 2,
  UVMode444 = 3,
}

/**
 * WebP v2 color space type options
 */
export enum Csp {
  kYCoCg = 0,
  kYCbCr = 1,
  kCustom = 2,
  kYIQ = 3,
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

export const label = 'WebP v2 (unstable)';
export const mimeType = 'image/webp2';
export const extension = 'wp2';

export const defaultOptions: EncodeOptions = {
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

interface WP2Module {
  encode(
    data: BufferSource,
    width: number,
    height: number,
    options: EncodeOptions,
  ): Uint8Array | null;
}

let modulePromise: Promise<WP2Module>;

async function initModule(): Promise<WP2Module> {
  const wp2Module = await import('../../../../codecs/wp2/enc/wp2_node_enc.js');

  // Get the path to the WASM file and read it directly
  // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../codecs/wp2/enc/wp2_node_enc.wasm'
  );
  const wasmBinary = await readFile(wasmPath);

  // Initialize with wasmBinary to avoid fetch
  const factory = wp2Module.default as unknown as (options?: {
    wasmBinary?: ArrayBuffer;
  }) => Promise<WP2Module>;

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
    throw new Error('WebP v2 encoding error');
  }

  return result.buffer as ArrayBuffer;
}
