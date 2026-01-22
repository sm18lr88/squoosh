/**
 * Hybrid Processing Bridge
 *
 * Unifies Tauri native backend and WASM worker processing.
 * Automatically routes processing to the most efficient backend:
 * - Tauri (native): When running as desktop/mobile app
 * - WASM Workers: When running as PWA or when Tauri is unavailable
 */

import * as tauri from './util/tauri-bridge';
import WorkerBridge from './worker-bridge';
import type { BridgeMethods } from './worker-bridge/meta';

/**
 * Backend type for processing
 */
export type BackendType = 'tauri' | 'wasm';

/**
 * Processing backend information
 */
export interface BackendInfo {
  type: BackendType;
  gpuAvailable: boolean;
  gpuBackend?: string;
  deviceName?: string;
}

/**
 * Options for hybrid bridge initialization
 */
export interface HybridBridgeOptions {
  /** Prefer WASM even when Tauri is available */
  preferWasm?: boolean;
  /** Log backend selection decisions */
  debug?: boolean;
}

/**
 * Hybrid Bridge class that provides unified access to processing backends
 */
class HybridBridge implements BridgeMethods {
  private _workerBridge: WorkerBridge;
  private _backendType: BackendType;
  private _initialized: boolean = false;
  private _initPromise: Promise<void> | null = null;
  private _gpuInfo: tauri.GpuInfo | null = null;
  private _options: HybridBridgeOptions;

  constructor(options: HybridBridgeOptions = {}) {
    this._options = options;
    this._workerBridge = new WorkerBridge();
    this._backendType = 'wasm'; // Default to WASM until initialized
  }

  /**
   * Initialize the hybrid bridge
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInitialize();
    await this._initPromise;
  }

  private async _doInitialize(): Promise<void> {
    // Check if Tauri is available and preferred
    if (tauri.isTauriContext() && !this._options.preferWasm) {
      try {
        const [platformInfo, gpuInfo] = await Promise.all([
          tauri.getPlatformInfo(),
          tauri.getGpuInfo(),
        ]);

        this._backendType = 'tauri';
        this._gpuInfo = gpuInfo;

        if (this._options.debug) {
          console.log('[HybridBridge] Tauri backend initialized');
          console.log('[HybridBridge] Platform:', platformInfo);
          console.log('[HybridBridge] GPU:', gpuInfo);
        }
      } catch (error) {
        console.warn('[HybridBridge] Tauri initialization failed, falling back to WASM:', error);
        this._backendType = 'wasm';
      }
    } else {
      this._backendType = 'wasm';
      if (this._options.debug) {
        console.log('[HybridBridge] Using WASM backend');
      }
    }

    this._initialized = true;
  }

  /**
   * Get information about the current backend
   */
  getBackendInfo(): BackendInfo {
    return {
      type: this._backendType,
      gpuAvailable: this._gpuInfo?.available ?? false,
      gpuBackend: this._gpuInfo?.backend,
      deviceName: this._gpuInfo?.deviceName,
    };
  }

  /**
   * Check if using native Tauri backend
   */
  isNative(): boolean {
    return this._backendType === 'tauri';
  }

  /**
   * Check if GPU acceleration is available
   */
  hasGpu(): boolean {
    return this._gpuInfo?.available ?? false;
  }

  // ============================================================================
  // Processing Methods (GPU-acceleratable via Tauri)
  // ============================================================================

  async resize(
    signal: AbortSignal,
    data: ImageData,
    width: number,
    height: number,
    options: { method: string; premultiply: boolean; linearRGB: boolean },
  ): Promise<ImageData> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriResize(signal, data, width, height, options);
    }
    return this._workerBridge.resize(signal, data, width, height, options);
  }

  private async _tauriResize(
    signal: AbortSignal,
    data: ImageData,
    width: number,
    height: number,
    options: { method: string; premultiply: boolean; linearRGB: boolean },
  ): Promise<ImageData> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);

    // Map method names to Tauri format
    const methodMap: Record<string, tauri.ResizeMethod> = {
      'lanczos3': 'lanczos3',
      'mitchell': 'mitchell',
      'catmull-rom': 'catmull_rom',
      'nearest': 'nearest',
      'bilinear': 'bilinear',
      'triangle': 'triangle',
    };

    const result = await tauri.resizeImage(tauriImage, {
      width,
      height,
      method: methodMap[options.method] || 'lanczos3',
      premultiply: options.premultiply,
      linearRgb: options.linearRGB,
    });

    this._checkAborted(signal);
    return tauri.tauriImageDataToBrowser(result);
  }

  async rotate(
    signal: AbortSignal,
    data: ImageData,
    options: { rotate: number },
  ): Promise<ImageData> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriRotate(signal, data, options);
    }
    return this._workerBridge.rotate(signal, data, options);
  }

  private async _tauriRotate(
    signal: AbortSignal,
    data: ImageData,
    options: { rotate: number },
  ): Promise<ImageData> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);

    // Map rotation degrees to Tauri format
    const angleMap: Record<number, tauri.RotateAngle> = {
      0: '0',
      90: '90',
      180: '180',
      270: '270',
    };

    const result = await tauri.rotateImage(tauriImage, {
      angle: angleMap[options.rotate] || '0',
    });

    this._checkAborted(signal);
    return tauri.tauriImageDataToBrowser(result);
  }

  async quantize(
    signal: AbortSignal,
    data: ImageData,
    options: { numColors: number; dither: number },
  ): Promise<ImageData> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriQuantize(signal, data, options);
    }
    return this._workerBridge.quantize(signal, data, options);
  }

  private async _tauriQuantize(
    signal: AbortSignal,
    data: ImageData,
    options: { numColors: number; dither: number },
  ): Promise<ImageData> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);

    const result = await tauri.quantizeImage(tauriImage, {
      colors: options.numColors,
      dither: options.dither,
    });

    this._checkAborted(signal);
    return tauri.tauriImageDataToBrowser(result);
  }

  // ============================================================================
  // Encoding Methods (CPU-based, but native Rust is faster)
  // ============================================================================

  async mozjpegEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriJpegEncode(signal, data, options);
    }
    return this._workerBridge.mozjpegEncode(signal, data, options);
  }

  private async _tauriJpegEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);
    const result = await tauri.encodeJpeg(tauriImage, {
      quality: options.quality,
      baseline: options.baseline,
      arithmetic: options.arithmetic,
      progressive: options.progressive,
      optimizeCoding: options.optimize_coding,
      smoothing: options.smoothing,
      colorSpace: options.color_space,
      quantTable: options.quant_table,
      trellisMultipass: options.trellis_multipass,
      trellisOptZero: options.trellis_opt_zero,
      trellisOptTable: options.trellis_opt_table,
      trellisLoops: options.trellis_loops,
      autoSubsample: options.auto_subsample,
      chromaSubsample: options.chroma_subsample,
      separateChromaQuality: options.separate_chroma_quality,
      chromaQuality: options.chroma_quality,
    });

    this._checkAborted(signal);
    return this._base64ToArrayBuffer(result.data);
  }

  async oxipngEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriPngEncode(signal, data, options);
    }
    return this._workerBridge.oxipngEncode(signal, data, options);
  }

  private async _tauriPngEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);
    const result = await tauri.encodePng(tauriImage, {
      level: options.level,
      interlace: options.interlace,
    });

    this._checkAborted(signal);
    return this._base64ToArrayBuffer(result.data);
  }

  async webpEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriWebpEncode(signal, data, options);
    }
    return this._workerBridge.webpEncode(signal, data, options);
  }

  private async _tauriWebpEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);
    const result = await tauri.encodeWebp(tauriImage, {
      quality: options.quality,
      targetSize: options.target_size,
      targetPsnr: options.target_PSNR,
      method: options.method,
      snsStrength: options.sns_strength,
      filterStrength: options.filter_strength,
      filterSharpness: options.filter_sharpness,
      filterType: options.filter_type,
      partitions: options.partitions,
      segments: options.segments,
      pass: options.pass,
      showCompressed: options.show_compressed,
      preprocessing: options.preprocessing,
      autofilter: options.autofilter,
      partitionLimit: options.partition_limit,
      alphaCompression: options.alpha_compression,
      alphaFiltering: options.alpha_filtering,
      alphaQuality: options.alpha_quality,
      lossless: options.lossless,
      nearLossless: options.near_lossless,
      exact: options.exact,
      imageHint: options.image_hint,
      emulateJpegSize: options.emulate_jpeg_size,
      threadLevel: options.thread_level,
      lowMemory: options.low_memory,
    });

    this._checkAborted(signal);
    return this._base64ToArrayBuffer(result.data);
  }

  async avifEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriAvifEncode(signal, data, options);
    }
    return this._workerBridge.avifEncode(signal, data, options);
  }

  private async _tauriAvifEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);
    const result = await tauri.encodeAvif(tauriImage, {
      cqLevel: options.cqLevel,
      cqAlphaLevel: options.cqAlphaLevel,
      denoisingLevel: options.denoiseLevel,
      tune: options.tune,
      tileColsLog2: options.tileColsLog2,
      tileRowsLog2: options.tileRowsLog2,
      speed: options.speed,
      subsample: options.subsample,
      chromaDeltaQ: options.chromaDeltaQ,
      sharpness: options.sharpness,
    });

    this._checkAborted(signal);
    return this._base64ToArrayBuffer(result.data);
  }

  async jxlEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriJxlEncode(signal, data, options);
    }
    return this._workerBridge.jxlEncode(signal, data, options);
  }

  private async _tauriJxlEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);
    const result = await tauri.encodeJxl(tauriImage, {
      quality: options.quality,
      effort: options.effort,
      progressive: options.progressive,
      epf: options.epf,
      losslessJpeg: options.lossyModular,
      nearLossless: options.nearLossless,
      nearLosslessQuality: options.nearLosslessQuality,
    });

    this._checkAborted(signal);
    return this._base64ToArrayBuffer(result.data);
  }

  async qoiEncode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriQoiEncode(signal, data, options);
    }
    return this._workerBridge.qoiEncode(signal, data, options);
  }

  private async _tauriQoiEncode(
    signal: AbortSignal,
    data: ImageData,
    _options: any,
  ): Promise<ArrayBuffer> {
    this._checkAborted(signal);

    const tauriImage = tauri.browserImageDataToTauri(data);
    const result = await tauri.encodeQoi(tauriImage, {});

    this._checkAborted(signal);
    return this._base64ToArrayBuffer(result.data);
  }

  async wp2Encode(
    signal: AbortSignal,
    data: ImageData,
    options: any,
  ): Promise<ArrayBuffer> {
    // WP2 only available via WASM (no Rust crate available)
    await this.initialize();
    return this._workerBridge.wp2Encode(signal, data, options);
  }

  // ============================================================================
  // Decoding Methods
  // ============================================================================

  async avifDecode(signal: AbortSignal, data: ArrayBuffer): Promise<ImageData> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriDecode(signal, data);
    }
    return this._workerBridge.avifDecode(signal, data);
  }

  async webpDecode(signal: AbortSignal, data: ArrayBuffer): Promise<ImageData> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriDecode(signal, data);
    }
    return this._workerBridge.webpDecode(signal, data);
  }

  async jxlDecode(signal: AbortSignal, data: ArrayBuffer): Promise<ImageData> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriDecode(signal, data);
    }
    return this._workerBridge.jxlDecode(signal, data);
  }

  async qoiDecode(signal: AbortSignal, data: ArrayBuffer): Promise<ImageData> {
    await this.initialize();

    if (this._backendType === 'tauri') {
      return this._tauriDecode(signal, data);
    }
    return this._workerBridge.qoiDecode(signal, data);
  }

  async wp2Decode(signal: AbortSignal, data: ArrayBuffer): Promise<ImageData> {
    // WP2 only available via WASM
    await this.initialize();
    return this._workerBridge.wp2Decode(signal, data);
  }

  private async _tauriDecode(
    signal: AbortSignal,
    data: ArrayBuffer,
  ): Promise<ImageData> {
    this._checkAborted(signal);

    const base64 = this._arrayBufferToBase64(data);
    const result = await tauri.decodeImage(base64);

    this._checkAborted(signal);
    return tauri.tauriImageDataToBrowser(result);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private _checkAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
  }

  private _arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private _base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Export singleton instance
export const hybridBridge = new HybridBridge({ debug: true });

// Also export the class for custom instances
export { HybridBridge };

// Export default for backwards compatibility
export default hybridBridge;
