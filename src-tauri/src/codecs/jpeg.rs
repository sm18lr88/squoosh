//! JPEG encoding using mozjpeg
//!
//! Provides high-quality JPEG compression with advanced options.

use super::{CodecError, CodecResult};
use crate::commands::encode::JpegOptions;

/// Encode RGBA image to JPEG
pub fn encode(rgba: &[u8], width: u32, height: u32, options: &JpegOptions) -> CodecResult<Vec<u8>> {
    use mozjpeg::{ColorSpace, Compress, ScanMode};

    if width == 0 || height == 0 {
        return Err(CodecError::InvalidDimensions { width, height });
    }

    // Convert RGBA to RGB (JPEG doesn't support alpha)
    let rgb: Vec<u8> = rgba
        .chunks_exact(4)
        .flat_map(|pixel| [pixel[0], pixel[1], pixel[2]])
        .collect();

    // Create compressor
    let mut comp = Compress::new(ColorSpace::JCS_RGB);

    comp.set_size(width as usize, height as usize);
    comp.set_quality(options.quality as f32);

    // Set scan mode
    if options.progressive {
        comp.set_scan_optimization_mode(ScanMode::Auto);
    }

    // Start compression
    let mut comp = comp.start_compress(Vec::new())
        .map_err(|e| CodecError::EncodingError(format!("Failed to start compression: {:?}", e)))?;

    // Write scanlines
    comp.write_scanlines(&rgb)
        .map_err(|e| CodecError::EncodingError(format!("Failed to write scanlines: {:?}", e)))?;

    // Finish compression
    let data = comp.finish()
        .map_err(|e| CodecError::EncodingError(format!("Failed to finish compression: {:?}", e)))?;

    Ok(data)
}

/// Simple JPEG encoding (browser-compatible)
pub fn encode_simple(rgba: &[u8], width: u32, height: u32, quality: u8) -> CodecResult<Vec<u8>> {
    let options = JpegOptions {
        quality,
        ..Default::default()
    };
    encode(rgba, width, height, &options)
}
