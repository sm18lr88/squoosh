# Tauri Icons

This directory contains app icons for Tauri builds.

## Required Icons

For a complete build, you need:

- `32x32.png` - 32x32 PNG icon
- `128x128.png` - 128x128 PNG icon
- `128x128@2x.png` - 256x256 PNG icon (for retina displays)
- `icon.icns` - macOS icon bundle
- `icon.ico` - Windows icon

## Generating Icons

You can generate all required icons from a single 1024x1024 PNG source using:

```bash
# Using Tauri CLI (recommended)
pnpm tauri icon path/to/source.png

# Or manually using ImageMagick
convert source.png -resize 32x32 32x32.png
convert source.png -resize 128x128 128x128.png
convert source.png -resize 256x256 128x128@2x.png
# For .ico and .icns, use platform-specific tools
```

## Squoosh Icon

The Squoosh icon source should be taken from the existing web app assets.
