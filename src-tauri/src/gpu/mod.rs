//! GPU acceleration module
//!
//! Provides hardware-accelerated image processing using wgpu.

mod wgpu_backend;

pub use wgpu_backend::WgpuBackend;

use crate::commands::process::{QuantizeOptions, ResizeOptions, RotateOptions};
use thiserror::Error;

/// GPU processing error type
#[derive(Error, Debug)]
pub enum GpuError {
    #[error("GPU not available")]
    NotAvailable,

    #[error("Initialization failed: {0}")]
    InitFailed(String),

    #[error("Processing failed: {0}")]
    ProcessingFailed(String),

    #[error("Shader error: {0}")]
    ShaderError(String),

    #[error("Buffer error: {0}")]
    BufferError(String),
}

pub type GpuResult<T> = Result<T, GpuError>;

/// GPU backend trait for image processing
pub trait GpuBackend: Send + Sync {
    /// Get human-readable device info
    fn device_info(&self) -> String;

    /// Get backend name (Vulkan, Metal, DX12, etc.)
    fn backend_name(&self) -> String;

    /// Get device name
    fn device_name(&self) -> String;

    /// Get vendor name (optional)
    fn vendor(&self) -> Option<String>;

    /// Get driver info (optional)
    fn driver_info(&self) -> Option<String>;

    /// Resize an image using GPU compute shaders
    fn resize(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
        options: &ResizeOptions,
    ) -> GpuResult<(u32, u32, Vec<u8>)>;

    /// Rotate an image using GPU
    fn rotate(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
        options: &RotateOptions,
    ) -> GpuResult<(u32, u32, Vec<u8>)>;

    /// Quantize an image using GPU
    fn quantize(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
        options: &QuantizeOptions,
    ) -> GpuResult<(u32, u32, Vec<u8>)>;
}
