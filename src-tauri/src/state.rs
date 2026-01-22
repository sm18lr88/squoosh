//! Application state management
//!
//! Manages shared state across the Tauri application, including GPU backend.

use crate::gpu::WgpuBackend;
use crate::platform::PlatformCapabilities;
use std::sync::Arc;

/// Application state shared across all Tauri commands
pub struct AppState {
    /// GPU backend for hardware acceleration (None if not available)
    pub gpu: Option<Arc<WgpuBackend>>,
    /// Platform capabilities
    pub capabilities: PlatformCapabilities,
}

impl AppState {
    /// Create new application state, initializing GPU if available
    pub fn new() -> Self {
        let capabilities = PlatformCapabilities::detect();

        // Try to initialize GPU backend
        let gpu = if capabilities.gpu_supported {
            log::info!("Attempting to initialize GPU backend...");
            match WgpuBackend::new() {
                Some(backend) => {
                    log::info!("GPU backend initialized successfully");
                    Some(backend)
                }
                None => {
                    log::warn!("GPU backend initialization failed, using CPU fallback");
                    None
                }
            }
        } else {
            log::info!("GPU not supported on this platform");
            None
        };

        Self { gpu, capabilities }
    }

    /// Check if GPU acceleration is available
    pub fn has_gpu(&self) -> bool {
        self.gpu.is_some()
    }

    /// Get GPU backend name
    pub fn gpu_backend_name(&self) -> Option<String> {
        self.gpu.as_ref().map(|g| g.backend_name())
    }

    /// Get GPU device info
    pub fn gpu_device_info(&self) -> Option<String> {
        self.gpu.as_ref().map(|g| g.device_info())
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
