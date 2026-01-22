/**
 * QOI decoder adapter for Node.js CLI
 * Uses QOI WASM decoder
 *
 * Note: QOI doesn't have a dedicated Node.js decoder, so we use the
 * worker version which works in Node.js environments.
 */

// Ensure ImageData polyfill is available
import '../../utils/image-data.js';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

interface QOIModule {
  decode(data: Uint8Array): ImageData | null;
}

type EmscriptenModuleFactory = (options?: { wasmBinary?: ArrayBuffer }) => Promise<QOIModule>;

let modulePromise: Promise<QOIModule>;

async function initModule(): Promise<QOIModule> {
  const module = await import('../../../../codecs/qoi/dec/qoi_dec.js');

  // Get the path to the WASM file and read it directly
  // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../codecs/qoi/dec/qoi_dec.wasm'
  );
  const wasmBinary = await readFile(wasmPath);

  // Initialize with wasmBinary to avoid fetch
  const factory = module.default as unknown as EmscriptenModuleFactory;
  return factory({
    wasmBinary: wasmBinary.buffer,
  });
}

export async function decode(data: Uint8Array): Promise<ImageData> {
  if (!modulePromise) {
    modulePromise = initModule();
  }
  const module = await modulePromise;
  const result = module.decode(data);
  if (!result) {
    throw new Error('QOI decoding failed');
  }
  return result;
}
