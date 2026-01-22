/**
 * PNG decoder adapter for Node.js CLI
 * Uses Rust WASM decoder (squoosh_png)
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Ensure ImageData polyfill is available
import '../../utils/image-data.js';

interface PngModule {
  decode(data: Uint8Array): ImageData;
}

let modulePromise: Promise<PngModule>;

async function initModule(): Promise<PngModule> {
  // The PNG codec uses wasm-bindgen which requires init() to be called
  const pngModule = await import('../../../../codecs/png/pkg/squoosh_png.js');

  // Get the path to the WASM file
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  const wasmPath = join(
    currentDir,
    '../../../../codecs/png/pkg/squoosh_png_bg.wasm',
  );

  // Read the WASM file and initialize
  const wasmBuffer = await readFile(wasmPath);
  const init = pngModule.default as unknown as (input: BufferSource) => Promise<unknown>;
  await init(wasmBuffer);

  return {
    decode: pngModule.decode as (data: Uint8Array) => ImageData,
  };
}

export async function decode(data: Uint8Array): Promise<ImageData> {
  if (!modulePromise) {
    modulePromise = initModule();
  }
  const module = await modulePromise;
  const result = module.decode(data);
  if (!result) {
    throw new Error('PNG decoding failed');
  }
  return result;
}
