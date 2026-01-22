//! Image codec implementations
//!
//! Wraps native Rust codec libraries for high-performance encoding.

pub mod avif;
pub mod jpeg;
pub mod jxl;
pub mod png;
pub mod qoi;
pub mod webp;

use thiserror::Error;

/// Codec error type
#[derive(Error, Debug)]
pub enum CodecError {
    #[error("Encoding failed: {0}")]
    EncodingError(String),

    #[error("Invalid dimensions: {width}x{height}")]
    InvalidDimensions { width: u32, height: u32 },

    #[error("Invalid options: {0}")]
    InvalidOptions(String),

    #[error("Codec not available: {0}")]
    NotAvailable(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type CodecResult<T> = Result<T, CodecError>;
