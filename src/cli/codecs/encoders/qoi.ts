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
 * QOI encoding options
 * QOI is a lossless format with minimal options
 */
export type EncodeOptions = Record<string, never>;

export const label = 'QOI';
export const mimeType = 'image/qoi';
export const extension = 'qoi';

export const defaultOptions: EncodeOptions = {};

interface QoiModule {
  encode(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options: EncodeOptions,
  ): Uint8Array | null;
}

type EmscriptenModuleFactory = (options?: { wasmBinary?: ArrayBuffer }) => Promise<QoiModule>;

let modulePromise: Promise<QoiModule>;

async function initModule(): Promise<QoiModule> {
  // QOI uses the standard Emscripten worker module
  const qoiModule = await import('../../../../codecs/qoi/enc/qoi_enc.js');

  // Get the path to the WASM file and read it directly
  // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../codecs/qoi/enc/qoi_enc.wasm'
  );
  const wasmBinary = await readFile(wasmPath);

  // Initialize with wasmBinary to avoid fetch
  const factory = qoiModule.default as unknown as EmscriptenModuleFactory;
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
    throw new Error('QOI encoding error');
  }

  return result.buffer as ArrayBuffer;
}
