# Squoosh

Compress and convert images to modern formats with significant size reductions. Supports JPEG, PNG, WebP, AVIF, JPEG XL, and more.

This tool lets you compare different codecs and quality settings to find the best balance between file size and visual quality. It includes both a web interface and a CLI for batch processing.

## Features

- Compress images with MozJPEG, OxiPNG, WebP, AVIF, JPEG XL, and more
- Resize images while compressing
- **Web App Batch Processing**: Drop thousands of files for parallel processing
- **Auto-Save**: Automatically save compressed files back to their original location (Chrome/Edge)
- Batch process entire directories via CLI
- Interactive mode with guided prompts
- Fast native backends with WASM fallback
- No telemetry or data collection - all processing happens locally

## Supported Formats

| Format  | Extension | Notes                                   |
| ------- | --------- | --------------------------------------- |
| MozJPEG | .jpg      | Optimized JPEG encoder                  |
| OxiPNG  | .png      | Optimized PNG encoder                   |
| WebP    | .webp     | Google's modern format                  |
| AVIF    | .avif     | AV1-based format, excellent compression |
| JPEG XL | .jxl      | Next-gen format with great quality      |
| QOI     | .qoi      | Fast lossless format                    |
| WebP2   | .wp2      | Experimental successor to WebP          |

## Installation

```sh
pnpm install
pnpm run build
pnpm run build:cli
```

## Usage

### Web App

The web interface provides two modes:

**Single Image Editor** (`/editor`)

- Drop or select a single image
- Compare original vs. compressed side-by-side
- Adjust encoder settings in real-time
- Download the compressed result

**Batch Processor** (`/batch`)

- Drop or select multiple images (supports thousands of files)
- Parallel processing using multiple web workers
- Choose output format and quality settings
- Progress tracking with compression statistics

#### Auto-Save Feature (Chrome/Edge)

When using Chrome or Edge, Squoosh can automatically save compressed files back to their original locations:

1. Use the **file picker** or **drag & drop** files into the app
2. The browser grants write access to the original file locations
3. Enable "Auto-Save to Original Location" (enabled by default when available)
4. Click "Process & Save" - files are compressed and saved automatically

This works because Squoosh uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to get writable file handles.

| Browser    | Auto-Save Support     |
| ---------- | --------------------- |
| Chrome 86+ | Yes                   |
| Edge 86+   | Yes                   |
| Firefox    | No (use ZIP download) |
| Safari     | No (use ZIP download) |

#### PWA / Installable App

Squoosh can be installed as a Progressive Web App for offline use. When installed:

- Works completely offline
- Behaves like a native desktop app
- All processing happens locally on your machine

#### Sharp Server (10-50x Faster Processing)

For maximum performance, run the Sharp server alongside the web app. This uses native libvips instead of WASM for significantly faster processing:

```sh
# Terminal 1: Start the Sharp server
npx squoosh serve

# Terminal 2: Open the web app
pnpm run dev
```

When the Sharp server is running, the web app automatically detects it and shows a green "Sharp Server" indicator. All batch processing will use the native backend.

| Mode           | Speed  | Use Case                                      |
| -------------- | ------ | --------------------------------------------- |
| WASM (default) | 1x     | Works everywhere, no setup needed             |
| Sharp Server   | 10-50x | Best for large batches, requires local server |

The Sharp server:

- Runs on `localhost:7331`
- Supports WebP, AVIF, JPEG, PNG formats
- Streams progress updates in real-time
- Works with auto-save to original locations

### CLI Commands

**Compress images:**

```sh
# Compress a single image to MozJPEG at 75% quality
npx squoosh compress image.png -f mozjpeg -q 75

# Compress to WebP with custom output directory
npx squoosh compress photo.jpg -f webp -q 80 -o ./output

# Batch compress a directory
npx squoosh compress ./images -r -f avif -q 70

# Resize while compressing
npx squoosh compress image.png -f webp --resize 800x600
```

**Interactive mode:**

```sh
npx squoosh interactive
```

**List available formats:**

```sh
npx squoosh formats
```

**Start Sharp server for web app acceleration:**

```sh
# Start server on default port (7331)
npx squoosh serve

# Start server on custom port
npx squoosh serve --port 8080
```

### CLI Options

**Compress command options:**

| Option                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| `-f, --format <format>` | Output format (mozjpeg, webp, avif, etc.)    |
| `-q, --quality <0-100>` | Quality level (default: 75)                  |
| `-o, --output <dir>`    | Output directory                             |
| `-r, --recursive`       | Process directories recursively              |
| `--ext <extensions>`    | File extensions to process (comma-separated) |
| `--suffix <suffix>`     | Add suffix to output filename                |
| `--resize <WxH>`        | Resize to width x height                     |
| `--parallel <n>`        | Number of parallel workers                   |
| `--replace`             | Delete originals after compression           |
| `--no-fast`             | Use WASM only (disable native backends)      |

**Serve command options:**

| Option                | Description                                 |
| --------------------- | ------------------------------------------- |
| `-p, --port <number>` | Server port (default: 7331)                 |
| `--allow-dir <dirs>`  | Comma-separated list of allowed directories |

## Privacy

**No telemetry. No uploads. All processing happens locally.**

- Single images and batch processing run entirely in your browser using WebAssembly
- Files never leave your device
- The web app works offline once loaded
- Auto-save writes directly to your local file system (with your permission)

## Contributing

To develop for Squoosh:

1. Clone the repository
2. Install dependencies:
   ```sh
   pnpm install
   ```
3. Build the app:
   ```sh
   pnpm run build
   ```
4. Start the development server:
   ```sh
   pnpm run dev
   ```

### Running Tests

```sh
pnpm test
```

## License

Squoosh is licensed under the Apache 2.0 license. See the [LICENSE](LICENSE) file for details.
