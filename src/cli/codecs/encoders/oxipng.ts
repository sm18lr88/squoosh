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
 * OxiPNG encoding options
 */
export interface EncodeOptions {
  level: number;
  interlace: boolean;
}

export const label = 'OxiPNG';
export const mimeType = 'image/png';
export const extension = 'png';

export const defaultOptions: EncodeOptions = {
  level: 2,
  interlace: false,
};

type OptimiseFunction = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  level: number,
  interlace: boolean,
) => Uint8Array;

let wasmReady: Promise<OptimiseFunction>;

async function initModule(): Promise<OptimiseFunction> {
  // For Node.js, we need to load the WASM module with wasm-bindgen
  const oxipngModule = await import(
    '../../../../codecs/oxipng/pkg/squoosh_oxipng.js'
  );

  // Get the path to the WASM file relative to the JS module
  const currentFileUrl = import.meta.url;
  const currentDir = dirname(fileURLToPath(currentFileUrl));
  const wasmPath = join(
    currentDir,
    '../../../../codecs/oxipng/pkg/squoosh_oxipng_bg.wasm',
  );

  // Read the WASM file and initialize the module
  const wasmBuffer = await readFile(wasmPath);
  const init = oxipngModule.default as unknown as (input: BufferSource) => Promise<unknown>;
  await init(wasmBuffer);

  return oxipngModule.optimise as OptimiseFunction;
}

/**
 * Pre-warm the WASM module for faster first encode
 */
export async function warmup(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initModule();
  }
  await wasmReady;
}

export async function encode(
  data: ImageData,
  options: EncodeOptions,
): Promise<ArrayBuffer> {
  if (!wasmReady) {
    wasmReady = initModule();
  }

  const optimise = await wasmReady;
  const result = optimise(
    data.data,
    data.width,
    data.height,
    options.level,
    options.interlace,
  );

  return result.buffer as ArrayBuffer;
}
