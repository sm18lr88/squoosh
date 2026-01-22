/**
 * QOI decoder adapter for Node.js CLI
 * Uses QOI WASM decoder
 *
 * Note: QOI doesn't have a dedicated Node.js decoder, so we use the
 * worker version which works in Node.js environments.
 */
import '../../utils/image-data.js';
export declare function decode(data: Uint8Array): Promise<ImageData>;
//# sourceMappingURL=qoi.d.ts.map