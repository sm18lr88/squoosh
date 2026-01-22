# Agent Guidelines for Squoosh

This document provides guidance for AI agents working on the Squoosh codebase.

## Project Overview

Squoosh is an image compression tool with:
- **Web app**: Browser-based image compression with visual comparison (in `src/client/`, `src/shared/`, `src/features/`)
- **CLI**: Command-line batch processing tool (in `src/cli/`)
- **Codecs**: WebAssembly modules for various image formats (in `codecs/`)

## Key Commands

```sh
# Install dependencies
pnpm install

# Build everything (web app)
pnpm run build

# Build CLI only
pnpm run build:cli

# Run development server
pnpm run dev

# Run tests
pnpm test

# Run tests with watch mode
pnpm test:watch

# Type checking (CLI)
pnpm run typecheck

# Lint CLI code
pnpm run lint
pnpm run lint:fix
```

## Project Structure

```
src/
├── cli/                    # CLI application
│   ├── index.ts           # Entry point, commander setup
│   ├── batch/             # Batch processing logic
│   │   ├── index.ts       # Main compress command implementation
│   │   └── scanner.ts     # File scanning utilities
│   ├── codecs/            # Encoder/decoder wrappers
│   │   ├── index.ts       # Codec registry
│   │   ├── encoders/      # Format-specific encoders
│   │   ├── decoders/      # Format-specific decoders
│   │   ├── sharp-backend.ts    # Native Sharp integration
│   │   └── native-backend.ts   # Native codec fallback
│   ├── interactive/       # Interactive mode prompts
│   └── utils/             # Progress reporting, output handling
├── client/                # Web app client code
├── features/              # Codec features (encoders/decoders/processors)
├── shared/                # Shared components
└── sw/                    # Service worker

codecs/                    # WebAssembly codec sources
├── avif/                  # AVIF encoder/decoder
├── mozjpeg/               # MozJPEG encoder
├── webp/                  # WebP encoder/decoder
├── jxl/                   # JPEG XL encoder/decoder
├── oxipng/                # OxiPNG encoder
├── qoi/                   # QOI encoder/decoder
└── ...
```

## CLI Architecture

The CLI uses a layered architecture:

1. **Entry point** (`src/cli/index.ts`): Commander.js program with commands
2. **Batch processor** (`src/cli/batch/`): Handles file scanning and parallel processing
3. **Codecs** (`src/cli/codecs/`): Unified interface to encoders/decoders
4. **Backends**: Multiple encoding backends with automatic fallback:
   - Sharp (native, fastest)
   - Native WASM (if available)
   - Pure WASM (fallback)

### Adding a New Encoder

1. Create encoder file in `src/cli/codecs/encoders/<name>.ts`
2. Export: `label`, `mimeType`, `extension`, `defaultOptions`, `encode()`, `warmup()`
3. Register in `src/cli/codecs/index.ts`

### Adding a New CLI Command

1. Add command definition in `src/cli/index.ts` using Commander.js
2. Implement handler in appropriate module

## Testing

Tests use Vitest and are co-located with source files:

```
src/cli/codecs/index.test.ts
src/cli/batch/index.test.ts
src/cli/batch/scanner.test.ts
```

Run specific test file:
```sh
pnpm test src/cli/codecs/index.test.ts
```

## Supported Formats

| Format | Encoder Name | Extension |
|--------|--------------|-----------|
| MozJPEG | `mozjpeg` | .jpg |
| AVIF | `avif` | .avif |
| WebP | `webp` | .webp |
| JPEG XL | `jxl` | .jxl |
| OxiPNG | `oxipng` | .png |
| QOI | `qoi` | .qoi |
| WebP2 | `wp2` | .wp2 |

## Common Tasks

### Modify compression defaults
Edit `defaultOptions` in the relevant encoder file under `src/cli/codecs/encoders/`.

### Add CLI option
1. Add `.option()` in `src/cli/index.ts`
2. Update `CompressOptions` interface in `src/cli/batch/index.ts`
3. Handle the option in `runCompress()`

### Debug encoding issues
Use `--no-fast` flag to force WASM-only encoding for consistent behavior.

## Code Style

- TypeScript with strict mode
- ESLint for CLI code
- Prettier for formatting
- Pre-commit hooks via Husky + lint-staged
