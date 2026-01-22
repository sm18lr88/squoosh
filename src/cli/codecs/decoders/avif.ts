/**
 * AVIF decoder adapter for Node.js CLI
 * Uses AVIF WASM decoder
 */

// Ensure ImageData polyfill is available
import '../../utils/image-data.js';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

interface AVIFModule {
  decode(data: Uint8Array): ImageData | null;
}

let modulePromise: Promise<AVIFModule>;

async function initModule(): Promise<AVIFModule> {
  const module = await import('../../../../codecs/avif/dec/avif_node_dec.js');

  // Get the path to the WASM file and read it directly
  // This bypasses Emscripten's fetch() which doesn't work with file:// URLs in Node.js
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../codecs/avif/dec/avif_node_dec.wasm'
  );
  const wasmBinary = await readFile(wasmPath);

  // Initialize with wasmBinary to avoid fetch
  const factory = module.default as unknown as (options?: {
    wasmBinary?: ArrayBuffer;
  }) => Promise<AVIFModule>;

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
    throw new Error('AVIF decoding failed');
  }
  return result;
}
