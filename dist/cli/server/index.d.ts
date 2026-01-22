/**
 * Sharp-based HTTP server for high-performance image processing
 * Provides native-speed processing to the Squoosh web app
 */
import { IncomingMessage, ServerResponse } from 'http';
export declare const MAX_FILE_SIZE: number;
export interface ServerOptions {
    port?: number;
    allowedDirs?: string[];
}
/**
 * Parse multipart form data (simplified version)
 */
export declare function parseMultipart(req: IncomingMessage): Promise<{
    fields: Record<string, string>;
    file?: Buffer;
    fileName?: string;
}>;
/**
 * Parse JSON body
 */
export declare function parseJSON(req: IncomingMessage): Promise<Record<string, unknown>>;
/**
 * Validate and resolve file path for security
 */
export declare function validatePath(inputPath: string, allowedDirs: string[]): string | null;
/**
 * Send JSON response
 */
export declare function sendJSON(res: ServerResponse, status: number, data: Record<string, unknown>): void;
/**
 * Send error response
 */
export declare function sendError(res: ServerResponse, status: number, message: string): void;
/**
 * Start the Sharp processing server
 */
export declare function startServer(options?: ServerOptions): Promise<void>;
//# sourceMappingURL=index.d.ts.map