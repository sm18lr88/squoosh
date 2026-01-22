/**
 * JPEG XL decoder adapter for Node.js CLI
 * Uses JXL WASM decoder
 */

// Ensure ImageData polyfill is available
import '../../utils/image-data.js';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

interface JXLModule {
  decode(data: Uint8Array): ImageData | null;
}

let modulePromise: Promise<JXLModule>;

async function initModule(): Promise<JXLModule> {
  const module = await import('../../../../codecs/jxl/dec/jxl_node_dec.js');

  // Get the path to the WASM file and read it directly
  // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../codecs/jxl/dec/jxl_node_dec.wasm'
  );
  const wasmBinary = await readFile(wasmPath);

  // Initialize with wasmBinary to avoid fetch
  const factory = module.default as unknown as (options?: {
    wasmBinary?: ArrayBuffer;
  }) => Promise<JXLModule>;

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
    throw new Error('JPEG XL decoding failed');
  }
  return result;
}
