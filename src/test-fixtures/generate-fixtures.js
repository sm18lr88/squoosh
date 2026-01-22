/**
 * Test fixture image generator for Squoosh test suite.
 *
 * This script generates various test images using Sharp for use in
 * unit tests, integration tests, and edge case testing.
 *
 * Usage: node src/test-fixtures/generate-fixtures.js
 */

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.join(__dirname, 'images');

/**
 * Ensure the images directory exists
 */
async function ensureDir() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

/**
 * Create a solid color buffer for a given size and color
 */
function createSolidColorBuffer(width, height, channels, color) {
  const pixelCount = width * height;
  const buffer = Buffer.alloc(pixelCount * channels);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * channels;
    for (let c = 0; c < channels; c++) {
      buffer[offset + c] = color[c];
    }
  }

  return buffer;
}

/**
 * Create an RGB gradient buffer
 */
function createGradientBuffer(width, height) {
  const buffer = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      // Red increases left to right
      buffer[offset] = Math.floor((x / width) * 255);
      // Green increases top to bottom
      buffer[offset + 1] = Math.floor((y / height) * 255);
      // Blue is a combination
      buffer[offset + 2] = Math.floor(((x + y) / (width + height)) * 255);
    }
  }

  return buffer;
}

/**
 * Create a checkerboard pattern buffer
 */
function createCheckerboardBuffer(width, height, squareSize = 20) {
  const buffer = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      const isWhite =
        (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
      const value = isWhite ? 255 : 0;
      buffer[offset] = value;
      buffer[offset + 1] = value;
      buffer[offset + 2] = value;
    }
  }

  return buffer;
}

/**
 * Create a detailed pattern buffer for medium images
 */
function createDetailedPatternBuffer(width, height) {
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;

      // Create concentric circles and gradients
      const centerX = width / 2;
      const centerY = height / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.hypot(dx, dy);
      const maxDistance = Math.hypot(centerX, centerY);

      // Red: radial gradient
      buffer[offset] = Math.floor((1 - distance / maxDistance) * 255);
      // Green: horizontal stripes
      buffer[offset + 1] = Math.floor(Math.sin(y * 0.1) * 127 + 128);
      // Blue: diagonal pattern
      buffer[offset + 2] = Math.floor(((x + y) % 256));
      // Alpha: fully opaque
      buffer[offset + 3] = 255;
    }
  }

  return buffer;
}

/**
 * Generate small test images (100x100)
 */
async function generateSmallImages() {
  console.log('Generating small images (100x100)...');

  // small-rgb.png - solid red
  await sharp(createSolidColorBuffer(100, 100, 3, [255, 0, 0]), {
    raw: { width: 100, height: 100, channels: 3 },
  })
    .png()
    .toFile(path.join(IMAGES_DIR, 'small-rgb.png'));
  console.log('  - small-rgb.png');

  // small-rgba.png - with transparency (semi-transparent blue)
  await sharp(createSolidColorBuffer(100, 100, 4, [0, 0, 255, 128]), {
    raw: { width: 100, height: 100, channels: 4 },
  })
    .png()
    .toFile(path.join(IMAGES_DIR, 'small-rgba.png'));
  console.log('  - small-rgba.png');

  // small.jpg - solid green RGB
  await sharp(createSolidColorBuffer(100, 100, 3, [0, 255, 0]), {
    raw: { width: 100, height: 100, channels: 3 },
  })
    .jpeg({ quality: 90 })
    .toFile(path.join(IMAGES_DIR, 'small.jpg'));
  console.log('  - small.jpg');

  // small.webp - solid yellow
  await sharp(createSolidColorBuffer(100, 100, 3, [255, 255, 0]), {
    raw: { width: 100, height: 100, channels: 3 },
  })
    .webp({ quality: 90 })
    .toFile(path.join(IMAGES_DIR, 'small.webp'));
  console.log('  - small.webp');

  // small.gif - solid magenta
  await sharp(createSolidColorBuffer(100, 100, 3, [255, 0, 255]), {
    raw: { width: 100, height: 100, channels: 3 },
  })
    .gif()
    .toFile(path.join(IMAGES_DIR, 'small.gif'));
  console.log('  - small.gif');
}

/**
 * Generate medium test images (800x600)
 */
async function generateMediumImages() {
  console.log('Generating medium images (800x600)...');

  // medium.jpg - gradient pattern
  await sharp(createGradientBuffer(800, 600), {
    raw: { width: 800, height: 600, channels: 3 },
  })
    .jpeg({ quality: 85 })
    .toFile(path.join(IMAGES_DIR, 'medium.jpg'));
  console.log('  - medium.jpg');

  // medium.png - detailed pattern with alpha
  await sharp(createDetailedPatternBuffer(800, 600), {
    raw: { width: 800, height: 600, channels: 4 },
  })
    .png()
    .toFile(path.join(IMAGES_DIR, 'medium.png'));
  console.log('  - medium.png');
}

/**
 * Generate test pattern images
 */
async function generateTestPatterns() {
  console.log('Generating test pattern images...');

  // gradient.png - 256x256 color gradient for quality testing
  await sharp(createGradientBuffer(256, 256), {
    raw: { width: 256, height: 256, channels: 3 },
  })
    .png()
    .toFile(path.join(IMAGES_DIR, 'gradient.png'));
  console.log('  - gradient.png');

  // checkerboard.png - 200x200 for compression artifact detection
  await sharp(createCheckerboardBuffer(200, 200, 20), {
    raw: { width: 200, height: 200, channels: 3 },
  })
    .png()
    .toFile(path.join(IMAGES_DIR, 'checkerboard.png'));
  console.log('  - checkerboard.png');
}

/**
 * Generate edge case images
 */
async function generateEdgeCases() {
  console.log('Generating edge case images...');

  // tiny.png - 1x1 pixel (white)
  await sharp(createSolidColorBuffer(1, 1, 3, [255, 255, 255]), {
    raw: { width: 1, height: 1, channels: 3 },
  })
    .png()
    .toFile(path.join(IMAGES_DIR, 'tiny.png'));
  console.log('  - tiny.png');

  // wide.png - 1000x10 (horizontal gradient)
  const wideBuffer = Buffer.alloc(1000 * 10 * 3);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 1000; x++) {
      const offset = (y * 1000 + x) * 3;
      wideBuffer[offset] = Math.floor((x / 1000) * 255);
      wideBuffer[offset + 1] = 128;
      wideBuffer[offset + 2] = 128;
    }
  }
  await sharp(wideBuffer, {
    raw: { width: 1000, height: 10, channels: 3 },
  })
    .png()
    .toFile(path.join(IMAGES_DIR, 'wide.png'));
  console.log('  - wide.png');

  // tall.png - 10x1000 (vertical gradient)
  const tallBuffer = Buffer.alloc(10 * 1000 * 3);
  for (let y = 0; y < 1000; y++) {
    for (let x = 0; x < 10; x++) {
      const offset = (y * 10 + x) * 3;
      tallBuffer[offset] = 128;
      tallBuffer[offset + 1] = Math.floor((y / 1000) * 255);
      tallBuffer[offset + 2] = 128;
    }
  }
  await sharp(tallBuffer, {
    raw: { width: 10, height: 1000, channels: 3 },
  })
    .png()
    .toFile(path.join(IMAGES_DIR, 'tall.png'));
  console.log('  - tall.png');
}

/**
 * Main function to generate all fixtures
 */
async function main() {
  console.log('Squoosh Test Fixture Generator');
  console.log('==============================\n');

  try {
    await ensureDir();

    await generateSmallImages();
    console.log('');

    await generateMediumImages();
    console.log('');

    await generateTestPatterns();
    console.log('');

    await generateEdgeCases();
    console.log('');

    console.log('All test fixtures generated successfully!');
    console.log(`Output directory: ${IMAGES_DIR}`);
  } catch (error) {
    console.error('Error generating fixtures:', error);
    process.exit(1);
  }
}

await main();
