//! WebP encoding using libwebp
//!
//! Provides WebP compression with lossy and lossless modes.

use super::{CodecError, CodecResult};
use crate::commands::encode::WebpOptions;

/// Encode RGBA image to WebP
pub fn encode(rgba: &[u8], width: u32, height: u32, options: &WebpOptions) -> CodecResult<Vec<u8>> {
    use webp::{Encoder, WebPMemory};

    if width == 0 || height == 0 {
        return Err(CodecError::InvalidDimensions { width, height });
    }

    // Create encoder from RGBA data
    let encoder = Encoder::from_rgba(rgba, width, height);

    let webp: WebPMemory = if options.lossless {
        encoder.encode_lossless()
    } else {
        encoder.encode(options.quality)
    };

    Ok(webp.to_vec())
}
