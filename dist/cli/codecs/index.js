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
import * as mozjpeg from './encoders/mozjpeg.js';
import * as avif from './encoders/avif.js';
import * as webp from './encoders/webp.js';
import * as jxl from './encoders/jxl.js';
import * as oxipng from './encoders/oxipng.js';
import * as qoi from './encoders/qoi.js';
import * as wp2 from './encoders/wp2.js';
/**
 * Registry of all available encoders.
 * Each encoder is keyed by its internal name.
 */
export const encoders = {
    mozjpeg: {
        name: 'mozjpeg',
        label: mozjpeg.label,
        mimeType: mozjpeg.mimeType,
        extension: mozjpeg.extension,
        defaultOptions: mozjpeg.defaultOptions,
        encode: mozjpeg.encode,
        warmup: mozjpeg.warmup,
    },
    avif: {
        name: 'avif',
        label: avif.label,
        mimeType: avif.mimeType,
        extension: avif.extension,
        defaultOptions: avif.defaultOptions,
        encode: avif.encode,
        warmup: avif.warmup,
    },
    webp: {
        name: 'webp',
        label: webp.label,
        mimeType: webp.mimeType,
        extension: webp.extension,
        defaultOptions: webp.defaultOptions,
        encode: webp.encode,
        warmup: webp.warmup,
    },
    jxl: {
        name: 'jxl',
        label: jxl.label,
        mimeType: jxl.mimeType,
        extension: jxl.extension,
        defaultOptions: jxl.defaultOptions,
        encode: jxl.encode,
        warmup: jxl.warmup,
    },
    oxipng: {
        name: 'oxipng',
        label: oxipng.label,
        mimeType: oxipng.mimeType,
        extension: oxipng.extension,
        defaultOptions: oxipng.defaultOptions,
        encode: oxipng.encode,
        warmup: oxipng.warmup,
    },
    qoi: {
        name: 'qoi',
        label: qoi.label,
        mimeType: qoi.mimeType,
        extension: qoi.extension,
        defaultOptions: qoi.defaultOptions,
        encode: qoi.encode,
        warmup: qoi.warmup,
    },
    wp2: {
        name: 'wp2',
        label: wp2.label,
        mimeType: wp2.mimeType,
        extension: wp2.extension,
        defaultOptions: wp2.defaultOptions,
        encode: wp2.encode,
        warmup: wp2.warmup,
    },
};
/**
 * Get an encoder by its name.
 * @param name - The internal name of the encoder (e.g., 'mozjpeg', 'avif')
 * @returns The codec info if found, undefined otherwise
 */
export function getEncoder(name) {
    return encoders[name];
}
/**
 * List all available encoder names.
 * @returns Array of encoder names
 */
export function listEncoders() {
    return Object.keys(encoders);
}
/**
 * Get all encoder information as an array.
 * @returns Array of all codec info objects
 */
export function getAllEncoders() {
    return Object.values(encoders);
}
/**
 * Find an encoder by its file extension.
 * @param extension - File extension (with or without leading dot)
 * @returns The codec info if found, undefined otherwise
 */
export function getEncoderByExtension(extension) {
    const ext = extension.startsWith('.') ? extension.slice(1) : extension;
    return Object.values(encoders).find((codec) => codec.extension === ext);
}
/**
 * Find an encoder by its MIME type.
 * @param mimeType - MIME type string
 * @returns The codec info if found, undefined otherwise
 */
export function getEncoderByMimeType(mimeType) {
    return Object.values(encoders).find((codec) => codec.mimeType === mimeType);
}
// Re-export enum types for convenience
export { MozJpegColorSpace } from './encoders/mozjpeg.js';
export { AVIFTune } from './encoders/avif.js';
export { UVMode, Csp } from './encoders/wp2.js';
