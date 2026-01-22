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
 * AVIF tuning options
 */
export enum AVIFTune {
  auto = 0,
  psnr = 1,
  ssim = 2,
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

export const label = 'AVIF';
export const mimeType = 'image/avif';
export const extension = 'avif';

export const defaultOptions: EncodeOptions = {
  quality: 50,
  qualityAlpha: -1,
  denoiseLevel: 0,
  tileColsLog2: 0,
  tileRowsLog2: 0,
  speed: 6,
  subsample: 1,
  chromaDeltaQ: false,
  sharpness: 0,
  tune: AVIFTune.auto,
  enableSharpYUV: false,
};

interface AVIFModule {
  encode(
    data: BufferSource,
    width: number,
    height: number,
    options: EncodeOptions,
  ): Uint8Array | null;
}

let modulePromise: Promise<AVIFModule>;

async function initModule(): Promise<AVIFModule> {
  const avifModule = await import(
    '../../../../codecs/avif/enc/avif_node_enc.js'
  );

  // Get the path to the WASM file and read it directly
  // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../codecs/avif/enc/avif_node_enc.wasm'
  );
  const wasmBinary = await readFile(wasmPath);

  // Initialize with wasmBinary to avoid fetch
  const factory = avifModule.default as unknown as (options?: {
    wasmBinary?: ArrayBuffer;
  }) => Promise<AVIFModule>;

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
    throw new Error('AVIF encoding error');
  }

  return result.buffer as ArrayBuffer;
}
