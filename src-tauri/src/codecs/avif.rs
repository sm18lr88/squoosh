//! AVIF encoding using ravif
//!
//! Provides AVIF compression with AV1 encoding.

use super::{CodecError, CodecResult};
use crate::commands::encode::AvifOptions;

/// Encode RGBA image to AVIF
pub fn encode(rgba: &[u8], width: u32, height: u32, options: &AvifOptions) -> CodecResult<Vec<u8>> {
    use ravif::{Encoder, Img, RGBA8};

    if width == 0 || height == 0 {
        return Err(CodecError::InvalidDimensions { width, height });
    }

    // Convert to RGBA8 pixels
    let pixels: Vec<RGBA8> = rgba
        .chunks_exact(4)
        .map(|c| RGBA8::new(c[0], c[1], c[2], c[3]))
        .collect();

    // Create image
    let img = Img::new(&pixels, width as usize, height as usize);

    // Configure encoder
    let mut encoder = Encoder::new()
        .with_quality(quality_from_cq(options.cq_level))
        .with_speed(options.speed);

    // Set alpha quality if specified
    if options.cq_alpha_level >= 0 {
        encoder = encoder.with_alpha_quality(quality_from_cq(options.cq_alpha_level as u8));
    }

    // Encode
    let result = encoder.encode_rgba(img)
        .map_err(|e| CodecError::EncodingError(format!("AVIF encoding failed: {}", e)))?;

    Ok(result.avif_file)
}

/// Convert CQ level (0-63) to quality (0.0-100.0)
fn quality_from_cq(cq: u8) -> f32 {
    // CQ 0 = highest quality, CQ 63 = lowest quality
    // Quality 100 = highest, Quality 0 = lowest
    100.0 - (cq as f32 / 63.0 * 100.0)
}
