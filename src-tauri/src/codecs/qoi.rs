//! QOI encoding
//!
//! Provides QOI (Quite OK Image) format encoding.

use super::{CodecError, CodecResult};
use crate::commands::encode::QoiOptions;

/// Encode RGBA image to QOI
pub fn encode(rgba: &[u8], width: u32, height: u32, _options: &QoiOptions) -> CodecResult<Vec<u8>> {
    use qoi::{encode_to_vec, Header};

    if width == 0 || height == 0 {
        return Err(CodecError::InvalidDimensions { width, height });
    }

    let header = Header {
        width,
        height,
        colors: qoi::Colors::Rgba,
    };

    let encoded = encode_to_vec(rgba, header)
        .map_err(|e| CodecError::EncodingError(format!("QOI encoding failed: {}", e)))?;

    Ok(encoded)
}
