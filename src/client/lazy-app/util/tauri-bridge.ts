/**
 * Tauri IPC Bridge
 *
 * Provides a TypeScript interface for communicating with the Tauri Rust backend.
 * This module handles the IPC layer for native image processing operations.
 */

// Type definitions for Tauri API
declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  }
}

/**
 * Check if we're running in a Tauri context
 */
export function isTauriContext(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Get the Tauri invoke function
 */
function getInvoke(): <T>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T> {
  if (!isTauriContext()) {
    throw new Error('Not running in Tauri context');
  }
  return window.__TAURI_INTERNALS__!.invoke;
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Image data structure for IPC transfer
 */
export interface ImageData {
  width: number;
  height: number;
  /** RGBA pixel data as base64-encoded bytes */
  data: string;
}

/**
 * Encoded image result
 */
export interface EncodeResult {
  /** Encoded bytes as base64 */
  data: string;
  /** Size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

/**
 * Platform information
 */
export interface PlatformInfo {
  os: string;
  arch: string;
  tauriVersion: string;
  gpuAvailable: boolean;
  gpuBackend?: string;
}

/**
 * GPU information
 */
export interface GpuInfo {
  available: boolean;
  backend?: string;
  deviceName?: string;
  vendor?: string;
  driverInfo?: string;
}

/**
 * Image information
 */
export interface ImageInfo {
  width: number;
  height: number;
  format?: string;
  colorType: string;
  hasAlpha: boolean;
  bitDepth: number;
}

// ============================================================================
// Codec Options
// ============================================================================

export interface JpegOptions {
  quality?: number;
  baseline?: boolean;
  arithmetic?: boolean;
  progressive?: boolean;
  optimizeCoding?: boolean;
  smoothing?: number;
  colorSpace?: number;
  quantTable?: number;
  trellisMultipass?: boolean;
  trellisOptZero?: boolean;
  trellisOptTable?: boolean;
  trellisLoops?: number;
  autoSubsample?: boolean;
  chromaSubsample?: number;
  separateChromaQuality?: boolean;
  chromaQuality?: number;
}

export interface PngOptions {
  level?: number;
  interlace?: boolean;
}

export interface WebpOptions {
  quality?: number;
  targetSize?: number;
  targetPsnr?: number;
  method?: number;
  snsStrength?: number;
  filterStrength?: number;
  filterSharpness?: number;
  filterType?: number;
  partitions?: number;
  segments?: number;
  pass?: number;
  showCompressed?: boolean;
  preprocessing?: number;
  autofilter?: boolean;
  partitionLimit?: number;
  alphaCompression?: boolean;
  alphaFiltering?: number;
  alphaQuality?: number;
  lossless?: boolean;
  nearLossless?: number;
  exact?: boolean;
  imageHint?: number;
  emulateJpegSize?: boolean;
  threadLevel?: boolean;
  lowMemory?: boolean;
}

export interface AvifOptions {
  cqLevel?: number;
  cqAlphaLevel?: number;
  denoisingLevel?: number;
  tune?: number;
  tileColsLog2?: number;
  tileRowsLog2?: number;
  speed?: number;
  subsample?: number;
  chromaDeltaQ?: boolean;
  sharpness?: number;
}

export interface JxlOptions {
  quality?: number;
  effort?: number;
  progressive?: boolean;
  epf?: number;
  losslessJpeg?: boolean;
  nearLossless?: number;
  nearLosslessQuality?: number;
}

export interface QoiOptions {}

// ============================================================================
// Processing Options
// ============================================================================

export type ResizeMethod =
  | 'lanczos3'
  | 'mitchell'
  | 'catmull_rom'
  | 'nearest'
  | 'bilinear'
  | 'triangle';

export type ResizeFit = 'stretch' | 'contain' | 'cover';

export interface ResizeOptions {
  width: number;
  height: number;
  method?: ResizeMethod;
  fit?: ResizeFit;
  premultiply?: boolean;
  linearRgb?: boolean;
}

export type RotateAngle = '0' | '90' | '180' | '270';

export interface RotateOptions {
  angle?: RotateAngle;
}

export interface QuantizeOptions {
  colors?: number;
  dither?: number;
}

// ============================================================================
// Batch Processing
// ============================================================================

export interface BatchOperation {
  type: 'resize' | 'rotate' | 'quantize';
  resize?: ResizeOptions;
  rotate?: RotateOptions;
  quantize?: QuantizeOptions;
}

export type BatchEncodeFormat =
  | { format: 'jpeg' } & JpegOptions
  | { format: 'png' } & PngOptions
  | { format: 'webp' } & WebpOptions
  | { format: 'avif' } & AvifOptions
  | { format: 'jxl' } & JxlOptions
  | { format: 'qoi' } & QoiOptions;

export interface BatchJob {
  inputPath: string;
  outputPath: string;
  operations: BatchOperation[];
  encode: BatchEncodeFormat;
}

export interface BatchResult {
  inputPath: string;
  outputPath: string;
  success: boolean;
  error?: string;
  inputSize?: number;
  outputSize?: number;
}

// ============================================================================
// Bridge Functions
// ============================================================================

/**
 * Get platform information
 */
export async function getPlatformInfo(): Promise<PlatformInfo> {
  const invoke = getInvoke();
  return invoke('platform_info');
}

/**
 * Get GPU information
 */
export async function getGpuInfo(): Promise<GpuInfo> {
  const invoke = getInvoke();
  return invoke('gpu_info');
}

/**
 * Decode an image from raw bytes
 */
export async function decodeImage(data: string): Promise<ImageData> {
  const invoke = getInvoke();
  return invoke('decode_image', { data });
}

/**
 * Get image information without fully decoding
 */
export async function getImageInfo(data: string): Promise<ImageInfo> {
  const invoke = getInvoke();
  return invoke('get_image_info', { data });
}

// ============================================================================
// Encoding Functions
// ============================================================================

/**
 * Encode image to JPEG using mozjpeg
 */
export async function encodeJpeg(
  image: ImageData,
  options: JpegOptions = {},
): Promise<EncodeResult> {
  const invoke = getInvoke();
  return invoke('encode_jpeg', { image, options });
}

/**
 * Encode image to PNG using oxipng
 */
export async function encodePng(
  image: ImageData,
  options: PngOptions = {},
): Promise<EncodeResult> {
  const invoke = getInvoke();
  return invoke('encode_png', { image, options });
}

/**
 * Encode image to WebP
 */
export async function encodeWebp(
  image: ImageData,
  options: WebpOptions = {},
): Promise<EncodeResult> {
  const invoke = getInvoke();
  return invoke('encode_webp', { image, options });
}

/**
 * Encode image to AVIF
 */
export async function encodeAvif(
  image: ImageData,
  options: AvifOptions = {},
): Promise<EncodeResult> {
  const invoke = getInvoke();
  return invoke('encode_avif', { image, options });
}

/**
 * Encode image to JXL
 */
export async function encodeJxl(
  image: ImageData,
  options: JxlOptions = {},
): Promise<EncodeResult> {
  const invoke = getInvoke();
  return invoke('encode_jxl', { image, options });
}

/**
 * Encode image to QOI
 */
export async function encodeQoi(
  image: ImageData,
  options: QoiOptions = {},
): Promise<EncodeResult> {
  const invoke = getInvoke();
  return invoke('encode_qoi', { image, options });
}

/**
 * Simple browser-compatible PNG encoding
 */
export async function encodeBrowserPng(image: ImageData): Promise<EncodeResult> {
  const invoke = getInvoke();
  return invoke('encode_browser_png', { image });
}

/**
 * Simple browser-compatible JPEG encoding
 */
export async function encodeBrowserJpeg(
  image: ImageData,
  quality: number = 75,
): Promise<EncodeResult> {
  const invoke = getInvoke();
  return invoke('encode_browser_jpeg', { image, quality });
}

// ============================================================================
// Processing Functions
// ============================================================================

/**
 * Resize an image
 */
export async function resizeImage(
  image: ImageData,
  options: ResizeOptions,
): Promise<ImageData> {
  const invoke = getInvoke();
  return invoke('resize_image', { image, options });
}

/**
 * Rotate an image
 */
export async function rotateImage(
  image: ImageData,
  options: RotateOptions,
): Promise<ImageData> {
  const invoke = getInvoke();
  return invoke('rotate_image', { image, options });
}

/**
 * Quantize an image (reduce color palette)
 */
export async function quantizeImage(
  image: ImageData,
  options: QuantizeOptions,
): Promise<ImageData> {
  const invoke = getInvoke();
  return invoke('quantize_image', { image, options });
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Read an image file and decode it
 */
export async function readFileAsImage(path: string): Promise<ImageData> {
  const invoke = getInvoke();
  return invoke('read_file_as_image', { path });
}

/**
 * Save encoded image data to a file
 */
export async function saveImageToFile(
  path: string,
  data: string,
): Promise<void> {
  const invoke = getInvoke();
  return invoke('save_image_to_file', { path, data });
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Process multiple images in batch
 */
export async function batchProcess(jobs: BatchJob[]): Promise<BatchResult[]> {
  const invoke = getInvoke();
  return invoke('batch_process', { jobs });
}

/**
 * Batch encode multiple images
 */
export async function batchEncode(
  images: ImageData[],
  format: BatchEncodeFormat,
): Promise<EncodeResult[]> {
  const invoke = getInvoke();
  return invoke('batch_encode', { images, format });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert browser ImageData to Tauri ImageData format
 */
export function browserImageDataToTauri(
  browserImageData: globalThis.ImageData,
): ImageData {
  // Convert Uint8ClampedArray to base64
  const base64 = arrayBufferToBase64(browserImageData.data.buffer);
  return {
    width: browserImageData.width,
    height: browserImageData.height,
    data: base64,
  };
}

/**
 * Convert Tauri ImageData to browser ImageData format
 */
export function tauriImageDataToBrowser(
  tauriImageData: ImageData,
): globalThis.ImageData {
  const bytes = base64ToArrayBuffer(tauriImageData.data);
  const clampedArray = new Uint8ClampedArray(bytes);
  return new globalThis.ImageData(
    clampedArray,
    tauriImageData.width,
    tauriImageData.height,
  );
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert EncodeResult to Blob
 */
export function encodeResultToBlob(result: EncodeResult): Blob {
  const bytes = base64ToArrayBuffer(result.data);
  return new Blob([bytes], { type: result.mimeType });
}

/**
 * Convert EncodeResult to File
 */
export function encodeResultToFile(
  result: EncodeResult,
  filename: string,
): File {
  const bytes = base64ToArrayBuffer(result.data);
  return new File([bytes], filename, { type: result.mimeType });
}
