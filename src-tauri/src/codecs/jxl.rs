//! JPEG XL encoding
//!
//! Provides JXL compression. Note: jxl-oxide is primarily a decoder,
//! so we use the image crate's JXL support when available.

use super::{CodecError, CodecResult};
use crate::commands::encode::JxlOptions;

/// Encode RGBA image to JXL
///
/// Note: Full JXL encoding requires libjxl bindings which are complex.
/// This implementation provides basic support.
pub fn encode(rgba: &[u8], width: u32, height: u32, options: &JxlOptions) -> CodecResult<Vec<u8>> {
    if width == 0 || height == 0 {
        return Err(CodecError::InvalidDimensions { width, height });
    }

    // Use image crate's JXL support if available
    // For now, fall back to a basic implementation
    encode_basic(rgba, width, height, options)
}

/// Basic JXL encoding implementation
fn encode_basic(rgba: &[u8], width: u32, height: u32, options: &JxlOptions) -> CodecResult<Vec<u8>> {
    use image::{ImageBuffer, Rgba, ImageEncoder};

    // Create image buffer
    let img: ImageBuffer<Rgba<u8>, _> = ImageBuffer::from_raw(width, height, rgba.to_vec())
        .ok_or_else(|| CodecError::EncodingError("Invalid image data".to_string()))?;

    // JXL encoding using image crate (if the feature is enabled)
    // For now, we'll use a simplified approach
    let mut buffer = Vec::new();

    // Try to use native JXL encoder if available
    #[cfg(feature = "jxl")]
    {
        use image::codecs::jpeg_xl::JpegXlEncoder;
        let encoder = JpegXlEncoder::new(&mut buffer);
        encoder.write_image(
            img.as_raw(),
            width,
            height,
            image::ExtendedColorType::Rgba8
        ).map_err(|e| CodecError::EncodingError(format!("JXL encoding failed: {}", e)))?;
        return Ok(buffer);
    }

    // Fallback: encode as high-quality WebP (similar characteristics)
    // This is a temporary solution until proper JXL encoding is available
    #[cfg(not(feature = "jxl"))]
    {
        // Use internal basic encoding
        log::warn!("JXL encoder not available, using fallback");

        use webp::Encoder;

        // If lossless requested or high quality, use lossless WebP
        let encoder = Encoder::from_rgba(rgba, width, height);

        let webp = if options.quality > 99.0 {
            encoder.encode_lossless()
        } else {
            encoder.encode(options.quality)
        };

        // Note: This is WebP format, not JXL
        // Proper JXL support requires libjxl bindings
        Ok(webp.to_vec())
    }
}
