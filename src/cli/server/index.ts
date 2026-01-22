/**
 * Sharp-based HTTP server for high-performance image processing
 * Provides native-speed processing to the Squoosh web app
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { parse } from 'node:url';
import {
  isSharpAvailable,
  processWithSharp,
  encodeWithSharp,
} from '../codecs/sharp-backend.js';
import { stat, writeFile } from 'node:fs/promises';
import { basename, resolve, isAbsolute } from 'node:path';

const DEFAULT_PORT = 7331;
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface ServerOptions {
  port?: number;
  allowedDirs?: string[];
}

interface ProcessResult {
  success: boolean;
  originalSize?: number;
  compressedSize?: number;
  error?: string;
}

interface BatchProgress {
  id: string;
  completed: number;
  total: number;
  currentFile?: string;
  results: ProcessResult[];
}

// Active batch operations for SSE streaming
const activeBatches = new Map<string, BatchProgress>();

/**
 * Parse multipart form data (simplified version)
 */
export async function parseMultipart(
  req: IncomingMessage
): Promise<{ fields: Record<string, string>; file?: Buffer; fileName?: string }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];

    if (!boundary) {
      reject(new Error('No boundary in content-type'));
      return;
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_FILE_SIZE) {
        reject(new Error('File too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const content = buffer.toString('binary');
      const parts = content.split(`--${boundary}`);

      const fields: Record<string, string> = {};
      let file: Buffer | undefined;
      let fileName: string | undefined;

      for (const part of parts) {
        if (part.includes('Content-Disposition')) {
          const nameMatch = part.match(/name="([^"]+)"/);
          const fileNameMatch = part.match(/filename="([^"]+)"/);
          const contentStart = part.indexOf('\r\n\r\n');

          if (contentStart !== -1 && nameMatch) {
            const name = nameMatch[1];
            let value = part.slice(contentStart + 4);

            // Remove trailing boundary markers
            if (value.endsWith('\r\n')) {
              value = value.slice(0, -2);
            }

            if (fileNameMatch) {
              fileName = fileNameMatch[1];
              file = Buffer.from(value, 'binary');
            } else {
              fields[name] = value.trim();
            }
          }
        }
      }

      resolve({ fields, file, fileName });
    });

    req.on('error', reject);
  });
}

/**
 * Parse JSON body
 */
export async function parseJSON(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Validate and resolve file path for security
 */
export function validatePath(
  inputPath: string,
  allowedDirs: string[]
): string | null {
  // Normalize and resolve to absolute path
  const absolutePath = isAbsolute(inputPath)
    ? resolve(inputPath)
    : resolve(process.cwd(), inputPath);

  // Check for directory traversal attempts
  if (absolutePath.includes('..')) {
    return null;
  }

  // If no allowed dirs specified, allow current working directory
  if (allowedDirs.length === 0) {
    return absolutePath;
  }

  // Check if path is within allowed directories
  for (const allowedDir of allowedDirs) {
    const resolvedAllowed = resolve(allowedDir);
    if (absolutePath.startsWith(resolvedAllowed)) {
      return absolutePath;
    }
  }

  return null;
}

/**
 * Send JSON response
 */
export function sendJSON(
  res: ServerResponse,
  status: number,
  data: Record<string, unknown>
): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
export function sendError(res: ServerResponse, status: number, message: string): void {
  sendJSON(res, status, { error: message });
}

/**
 * Start the Sharp processing server
 */
export async function startServer(options: ServerOptions = {}): Promise<void> {
  const port = options.port || DEFAULT_PORT;
  const allowedDirs = options.allowedDirs || [];

  if (!isSharpAvailable()) {
    console.error('Error: Sharp is not available. Cannot start server.');
    console.error('Make sure sharp is installed: pnpm add sharp');
    process.exit(1);
  }

  const server = createServer(async (req, res) => {
    // CORS headers for browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const { pathname } = parse(req.url || '/');

    try {
      // Health check endpoint
      if (pathname === '/health' && req.method === 'GET') {
        sendJSON(res, 200, {
          status: 'ok',
          backend: 'sharp',
          version: '1.0.0',
          formats: ['webp', 'avif', 'jpeg', 'png'],
        });
        return;
      }

      // Process file and return blob
      if (pathname === '/process' && req.method === 'POST') {
        const { fields, file } = await parseMultipart(req);

        if (!file) {
          sendError(res, 400, 'No file provided');
          return;
        }

        const format = fields.format || 'webp';
        const quality = Number.parseInt(fields.quality || '75', 10);

        // Decode the image
        const sharp = (await import('sharp')).default;
        const image = sharp(file);

        // Create ImageData from raw pixels
        const { data, info } = await image
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Copy to a new ArrayBuffer to ensure proper type (not SharedArrayBuffer)
        const arrayBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(arrayBuffer).set(data);

        const imageData: ImageData = {
          data: new Uint8ClampedArray(arrayBuffer),
          width: info.width,
          height: info.height,
          colorSpace: 'srgb',
        };

        // Encode with Sharp
        const encoded = await encodeWithSharp(imageData, format, { quality });
        const outputBuffer = Buffer.from(encoded);

        // Get MIME type
        const mimeTypes: Record<string, string> = {
          webp: 'image/webp',
          avif: 'image/avif',
          jpeg: 'image/jpeg',
          mozjpeg: 'image/jpeg',
          png: 'image/png',
          oxipng: 'image/png',
        };

        res.writeHead(200, {
          'Content-Type': mimeTypes[format] || 'application/octet-stream',
          'Content-Length': outputBuffer.length,
          'X-Original-Size': file.length,
          'X-Compressed-Size': outputBuffer.length,
        });
        res.end(outputBuffer);
        return;
      }

      // Process file from path and save to destination
      if (pathname === '/process-save' && req.method === 'POST') {
        const body = (await parseJSON(req)) as {
          inputPath: string;
          outputPath?: string;
          format: string;
          quality: number;
        };

        const inputPath = validatePath(body.inputPath, allowedDirs);
        if (!inputPath) {
          sendError(res, 403, 'Input path not allowed');
          return;
        }

        // Output path defaults to input path with new extension
        const format = body.format || 'webp';
        const extensions: Record<string, string> = {
          webp: '.webp',
          avif: '.avif',
          jpeg: '.jpg',
          mozjpeg: '.jpg',
          png: '.png',
          oxipng: '.png',
        };
        const ext = extensions[format] || '.webp';

        let outputPath = body.outputPath
          ? validatePath(body.outputPath, allowedDirs)
          : inputPath.replace(/\.[^.]+$/, ext);

        if (!outputPath) {
          sendError(res, 403, 'Output path not allowed');
          return;
        }

        const quality = body.quality || 75;

        // Get original file size
        const inputStat = await stat(inputPath);
        const originalSize = inputStat.size;

        // Process with Sharp
        const encoded = await processWithSharp(inputPath, format, { quality });
        const outputBuffer = Buffer.from(encoded);

        // Write output
        await writeFile(outputPath, outputBuffer);

        sendJSON(res, 200, {
          success: true,
          inputPath,
          outputPath,
          originalSize,
          compressedSize: outputBuffer.length,
          savings: originalSize - outputBuffer.length,
          savingsPercent: (((originalSize - outputBuffer.length) / originalSize) * 100).toFixed(1),
        });
        return;
      }

      // Batch processing with SSE progress
      if (pathname === '/batch' && req.method === 'POST') {
        const body = (await parseJSON(req)) as {
          files: Array<{
            inputPath: string;
            outputPath?: string;
          }>;
          format: string;
          quality: number;
        };

        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const total = body.files.length;

        // Initialize batch progress
        activeBatches.set(batchId, {
          id: batchId,
          completed: 0,
          total,
          results: [],
        });

        // Set up SSE response
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        // Send initial event
        res.write(`data: ${JSON.stringify({ type: 'start', batchId, total })}\n\n`);

        const format = body.format || 'webp';
        const quality = body.quality || 75;
        const extensions: Record<string, string> = {
          webp: '.webp',
          avif: '.avif',
          jpeg: '.jpg',
          mozjpeg: '.jpg',
          png: '.png',
          oxipng: '.png',
        };
        const ext = extensions[format] || '.webp';

        // Process files sequentially to stream progress
        for (let i = 0; i < body.files.length; i++) {
          const fileInfo = body.files[i];
          const inputPath = validatePath(fileInfo.inputPath, allowedDirs);

          if (!inputPath) {
            const result: ProcessResult = {
              success: false,
              error: 'Path not allowed',
            };
            activeBatches.get(batchId)!.results.push(result);
            activeBatches.get(batchId)!.completed++;

            res.write(
              `data: ${JSON.stringify({
                type: 'progress',
                completed: i + 1,
                total,
                file: basename(fileInfo.inputPath),
                success: false,
                error: 'Path not allowed',
              })}\n\n`
            );
            continue;
          }

          try {
            const inputStat = await stat(inputPath);
            const originalSize = inputStat.size;

            let outputPath = fileInfo.outputPath
              ? validatePath(fileInfo.outputPath, allowedDirs)
              : inputPath.replace(/\.[^.]+$/, ext);

            if (!outputPath) {
              throw new Error('Output path not allowed');
            }

            const encoded = await processWithSharp(inputPath, format, { quality });
            const outputBuffer = Buffer.from(encoded);
            await writeFile(outputPath, outputBuffer);

            const result: ProcessResult = {
              success: true,
              originalSize,
              compressedSize: outputBuffer.length,
            };
            activeBatches.get(batchId)!.results.push(result);
            activeBatches.get(batchId)!.completed++;

            res.write(
              `data: ${JSON.stringify({
                type: 'progress',
                completed: i + 1,
                total,
                file: basename(inputPath),
                success: true,
                originalSize,
                compressedSize: outputBuffer.length,
              })}\n\n`
            );
          } catch (err) {
            const result: ProcessResult = {
              success: false,
              error: err instanceof Error ? err.message : String(err),
            };
            activeBatches.get(batchId)!.results.push(result);
            activeBatches.get(batchId)!.completed++;

            res.write(
              `data: ${JSON.stringify({
                type: 'progress',
                completed: i + 1,
                total,
                file: basename(fileInfo.inputPath),
                success: false,
                error: err instanceof Error ? err.message : String(err),
              })}\n\n`
            );
          }
        }

        // Calculate totals
        const batch = activeBatches.get(batchId)!;
        const successful = batch.results.filter((r) => r.success);
        const totalOriginal = successful.reduce((sum, r) => sum + (r.originalSize || 0), 0);
        const totalCompressed = successful.reduce((sum, r) => sum + (r.compressedSize || 0), 0);

        // Send completion event
        res.write(
          `data: ${JSON.stringify({
            type: 'complete',
            batchId,
            totalFiles: total,
            successCount: successful.length,
            failCount: batch.results.length - successful.length,
            totalOriginalSize: totalOriginal,
            totalCompressedSize: totalCompressed,
            totalSavings: totalOriginal - totalCompressed,
          })}\n\n`
        );

        res.end();
        activeBatches.delete(batchId);
        return;
      }

      // 404 for unknown routes
      sendError(res, 404, 'Not found');
    } catch (err) {
      console.error('Server error:', err);
      sendError(res, 500, err instanceof Error ? err.message : 'Internal server error');
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`\n  Squoosh Sharp Server`);
    console.log(`  ====================`);
    console.log(`  Local:   http://localhost:${port}`);
    console.log(`  Backend: Sharp (native libvips)`);
    console.log(`  Formats: WebP, AVIF, JPEG, PNG`);
    console.log(`\n  The web app will automatically detect and use this server.`);
    console.log(`  Press Ctrl+C to stop.\n`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Shutting down server...');
    server.close(() => {
      console.log('  Server stopped.');
      process.exit(0);
    });
  });
}
