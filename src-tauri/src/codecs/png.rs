//! PNG encoding using oxipng
//!
//! Provides optimized PNG compression.

use super::{CodecError, CodecResult};
use crate::commands::encode::PngOptions;

/// Encode RGBA image to PNG
pub fn encode(rgba: &[u8], width: u32, height: u32, options: &PngOptions) -> CodecResult<Vec<u8>> {
    use oxipng::{optimize_from_memory, Options, Interlacing};

    if width == 0 || height == 0 {
        return Err(CodecError::InvalidDimensions { width, height });
    }

    // First, create a basic PNG using the image crate
    let basic_png = encode_simple(rgba, width, height)?;

    // Then optimize with oxipng
    let mut opts = Options::from_preset(options.level);

    opts.interlace = if options.interlace {
        Some(Interlacing::Adam7)
    } else {
        Some(Interlacing::None)
    };

    let optimized = optimize_from_memory(&basic_png, &opts)
        .map_err(|e| CodecError::EncodingError(format!("PNG optimization failed: {}", e)))?;

    Ok(optimized)
}

/// Simple PNG encoding without optimization
pub fn encode_simple(rgba: &[u8], width: u32, height: u32) -> CodecResult<Vec<u8>> {
    use image::{ImageBuffer, Rgba, ImageEncoder};
    use image::codecs::png::PngEncoder;

    if width == 0 || height == 0 {
        return Err(CodecError::InvalidDimensions { width, height });
    }

    let img: ImageBuffer<Rgba<u8>, _> = ImageBuffer::from_raw(width, height, rgba.to_vec())
        .ok_or_else(|| CodecError::EncodingError("Invalid image data".to_string()))?;

    let mut buffer = Vec::new();
    let encoder = PngEncoder::new(&mut buffer);

    encoder.write_image(
        img.as_raw(),
        width,
        height,
        image::ExtendedColorType::Rgba8
    ).map_err(|e| CodecError::EncodingError(format!("PNG encoding failed: {}", e)))?;

    Ok(buffer)
}
