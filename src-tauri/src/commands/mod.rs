//! Tauri command handlers for Squoosh
//!
//! This module contains all IPC commands exposed to the frontend.

pub mod batch;
pub mod decode;
pub mod encode;
pub mod file_ops;
pub mod process;

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Platform information returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
    pub tauri_version: String,
    pub gpu_available: bool,
    pub gpu_backend: Option<String>,
}

/// GPU information returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct GpuInfo {
    pub available: bool,
    pub backend: Option<String>,
    pub device_name: Option<String>,
    pub vendor: Option<String>,
    pub driver_info: Option<String>,
}

/// Get platform information
#[tauri::command]
pub fn platform_info(state: State<'_, AppState>) -> PlatformInfo {
    PlatformInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        tauri_version: tauri::VERSION.to_string(),
        gpu_available: state.gpu.is_some(),
        gpu_backend: state.gpu.as_ref().map(|g| g.backend_name()),
    }
}

/// Get detailed GPU information
#[tauri::command]
pub fn gpu_info(state: State<'_, AppState>) -> GpuInfo {
    match &state.gpu {
        Some(gpu) => GpuInfo {
            available: true,
            backend: Some(gpu.backend_name()),
            device_name: Some(gpu.device_name()),
            vendor: gpu.vendor(),
            driver_info: gpu.driver_info(),
        },
        None => GpuInfo {
            available: false,
            backend: None,
            device_name: None,
            vendor: None,
            driver_info: None,
        },
    }
}

/// Common image data structure for IPC transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageData {
    pub width: u32,
    pub height: u32,
    /// RGBA pixel data as base64-encoded bytes
    pub data: String,
}

impl ImageData {
    /// Create ImageData from raw RGBA bytes
    pub fn from_rgba(width: u32, height: u32, rgba: &[u8]) -> Self {
        use base64::{engine::general_purpose::STANDARD, Engine};
        Self {
            width,
            height,
            data: STANDARD.encode(rgba),
        }
    }

    /// Extract raw RGBA bytes
    pub fn to_rgba(&self) -> Result<Vec<u8>, base64::DecodeError> {
        use base64::{engine::general_purpose::STANDARD, Engine};
        STANDARD.decode(&self.data)
    }

    /// Calculate total pixel count
    pub fn pixel_count(&self) -> u64 {
        self.width as u64 * self.height as u64
    }
}

/// Encoded image result
#[derive(Debug, Clone, Serialize)]
pub struct EncodeResult {
    /// Encoded bytes as base64
    pub data: String,
    /// Size in bytes
    pub size: usize,
    /// MIME type
    pub mime_type: String,
}

impl EncodeResult {
    pub fn new(data: Vec<u8>, mime_type: &str) -> Self {
        use base64::{engine::general_purpose::STANDARD, Engine};
        let size = data.len();
        Self {
            data: STANDARD.encode(&data),
            size,
            mime_type: mime_type.to_string(),
        }
    }
}
