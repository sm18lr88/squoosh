/**
 * Client-side utilities for communicating with the Sharp processing server
 * When the server is running, it provides native-speed image processing
 */

const SERVER_URL = 'http://localhost:7331';
const HEALTH_CHECK_TIMEOUT = 1000;

export interface SharpServerStatus {
  available: boolean;
  version?: string;
  formats?: string[];
}

export interface ProcessResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
}

export interface SaveResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  savings: number;
  savingsPercent: string;
}

export interface BatchProgressEvent {
  type: 'start' | 'progress' | 'complete';
  batchId?: string;
  completed?: number;
  total?: number;
  file?: string;
  success?: boolean;
  error?: string;
  originalSize?: number;
  compressedSize?: number;
  // Complete event fields
  totalFiles?: number;
  successCount?: number;
  failCount?: number;
  totalOriginalSize?: number;
  totalCompressedSize?: number;
  totalSavings?: number;
}

/**
 * Check if the Sharp server is running and available
 */
export async function checkSharpServer(): Promise<SharpServerStatus> {
  try {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(`${SERVER_URL}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        version: data.version,
        formats: data.formats,
      };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

/**
 * Map web app encoder types to server format names
 */
export function mapFormat(encoderType: string): string {
  const mapping: Record<string, string> = {
    mozJPEG: 'mozjpeg',
    oxiPNG: 'oxipng',
    webP: 'webp',
    avif: 'avif',
    jxl: 'jxl',
    qoi: 'qoi',
    wp2: 'wp2',
    browserGIF: 'gif',
    browserJPEG: 'jpeg',
    browserPNG: 'png',
  };
  return mapping[encoderType] || encoderType.toLowerCase();
}

/**
 * Extract quality value from encoder options
 */
export function getQuality(options: Record<string, unknown>): number {
  // Different encoders use different property names
  if (typeof options.quality === 'number') return options.quality;
  if (typeof options.cqLevel === 'number') return 100 - options.cqLevel; // AVIF uses inverse scale
  return 75; // Default
}

/**
 * Process an image file via the Sharp server
 * @param file The file to process
 * @param encoderType The encoder type (e.g., 'mozJPEG', 'webP')
 * @param options Encoder options
 * @returns The compressed blob with size info
 */
export async function processViaServer(
  file: File,
  encoderType: string,
  options: Record<string, unknown>
): Promise<ProcessResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', mapFormat(encoderType));
  formData.append('quality', String(getQuality(options)));

  const response = await fetch(`${SERVER_URL}/process`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server error: ${errorText}`);
  }

  const blob = await response.blob();
  const originalSize = Number.parseInt(response.headers.get('X-Original-Size') || '0', 10);
  const compressedSize = Number.parseInt(response.headers.get('X-Compressed-Size') || String(blob.size), 10);

  return { blob, originalSize, compressedSize };
}

/**
 * Process and save a file directly via the Sharp server
 * This is the fastest path - server reads, processes, and writes to disk
 * @param inputPath Full path to the input file
 * @param outputPath Full path for the output file
 * @param encoderType The encoder type
 * @param options Encoder options
 */
export async function processAndSaveViaServer(
  inputPath: string,
  outputPath: string,
  encoderType: string,
  options: Record<string, unknown>
): Promise<SaveResult> {
  const response = await fetch(`${SERVER_URL}/process-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputPath,
      outputPath,
      format: mapFormat(encoderType),
      quality: getQuality(options),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Server error');
  }

  return response.json();
}

/**
 * Process multiple files in batch via the Sharp server with progress streaming
 * @param files Array of file info with paths
 * @param encoderType The encoder type
 * @param options Encoder options
 * @param onProgress Callback for progress updates
 */
export async function processBatchViaServer(
  files: Array<{ inputPath: string; outputPath?: string }>,
  encoderType: string,
  options: Record<string, unknown>,
  onProgress: (event: BatchProgressEvent) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      files,
      format: mapFormat(encoderType),
      quality: getQuality(options),
    });

    // Use fetch with ReadableStream for SSE
    fetch(`${SERVER_URL}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json();
          reject(new Error(errorData.error || 'Server error'));
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          reject(new Error('No response body'));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            resolve();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6)) as BatchProgressEvent;
                onProgress(event);

                if (event.type === 'complete') {
                  resolve();
                  return;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      })
      .catch(reject);
  });
}

/**
 * Get the server URL for external reference
 */
export function getServerUrl(): string {
  return SERVER_URL;
}
