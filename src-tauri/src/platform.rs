//! Platform detection and capability module
//!
//! Provides functions to detect platform capabilities and constraints.

use serde::Serialize;

/// Platform capabilities
#[derive(Debug, Clone, Serialize)]
pub struct PlatformCapabilities {
    /// Operating system
    pub os: Os,
    /// CPU architecture
    pub arch: Arch,
    /// Whether GPU acceleration is supported
    pub gpu_supported: bool,
    /// Whether multithreading is supported
    pub threading_supported: bool,
    /// Maximum recommended image dimension
    pub max_image_dimension: u32,
    /// Maximum recommended batch size
    pub max_batch_size: usize,
    /// Large file warning threshold in bytes
    pub large_file_warning_bytes: u64,
}

/// Operating system type
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Os {
    Windows,
    MacOS,
    Linux,
    iOS,
    Android,
    Unknown,
}

/// CPU architecture
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Arch {
    X86_64,
    Aarch64,
    Arm,
    Wasm32,
    Unknown,
}

impl PlatformCapabilities {
    /// Detect current platform capabilities
    pub fn detect() -> Self {
        let os = detect_os();
        let arch = detect_arch();
        let is_mobile = matches!(os, Os::iOS | Os::Android);

        Self {
            os,
            arch,
            gpu_supported: is_gpu_supported(os, arch),
            threading_supported: true, // Rust threading works everywhere
            max_image_dimension: if is_mobile { 8192 } else { 32768 },
            max_batch_size: if is_mobile { 10 } else { 100 },
            large_file_warning_bytes: if is_mobile { 50 * 1024 * 1024 } else { 200 * 1024 * 1024 },
        }
    }

    /// Check if we're running on a mobile platform
    pub fn is_mobile(&self) -> bool {
        matches!(self.os, Os::iOS | Os::Android)
    }

    /// Check if we're running on a desktop platform
    pub fn is_desktop(&self) -> bool {
        matches!(self.os, Os::Windows | Os::MacOS | Os::Linux)
    }

    /// Get recommended processing thresholds
    pub fn processing_thresholds(&self) -> ProcessingThresholds {
        if self.is_mobile() {
            ProcessingThresholds {
                gpu_resize_min_pixels: 500_000, // 0.5 MP
                gpu_rotate_min_pixels: 250_000, // 0.25 MP
                gpu_quantize_min_pixels: 1_000_000, // 1 MP
            }
        } else {
            ProcessingThresholds {
                gpu_resize_min_pixels: 1_000_000, // 1 MP
                gpu_rotate_min_pixels: 500_000, // 0.5 MP
                gpu_quantize_min_pixels: 2_000_000, // 2 MP
            }
        }
    }
}

/// Processing thresholds for GPU vs CPU decision
#[derive(Debug, Clone, Copy)]
pub struct ProcessingThresholds {
    pub gpu_resize_min_pixels: u64,
    pub gpu_rotate_min_pixels: u64,
    pub gpu_quantize_min_pixels: u64,
}

/// Detect current operating system
fn detect_os() -> Os {
    #[cfg(target_os = "windows")]
    return Os::Windows;

    #[cfg(target_os = "macos")]
    return Os::MacOS;

    #[cfg(target_os = "linux")]
    return Os::Linux;

    #[cfg(target_os = "ios")]
    return Os::iOS;

    #[cfg(target_os = "android")]
    return Os::Android;

    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "linux",
        target_os = "ios",
        target_os = "android"
    )))]
    Os::Unknown
}

/// Detect current CPU architecture
fn detect_arch() -> Arch {
    #[cfg(target_arch = "x86_64")]
    return Arch::X86_64;

    #[cfg(target_arch = "aarch64")]
    return Arch::Aarch64;

    #[cfg(target_arch = "arm")]
    return Arch::Arm;

    #[cfg(target_arch = "wasm32")]
    return Arch::Wasm32;

    #[cfg(not(any(
        target_arch = "x86_64",
        target_arch = "aarch64",
        target_arch = "arm",
        target_arch = "wasm32"
    )))]
    Arch::Unknown
}

/// Check if GPU acceleration is supported on this platform
fn is_gpu_supported(os: Os, _arch: Arch) -> bool {
    match os {
        Os::Windows => true,  // DirectX 12 / Vulkan
        Os::MacOS => true,    // Metal
        Os::Linux => true,    // Vulkan
        Os::iOS => true,      // Metal
        Os::Android => true,  // Vulkan (with fallbacks)
        Os::Unknown => false,
    }
}

/// Get preferred GPU backend for this platform
pub fn preferred_gpu_backend(os: Os) -> &'static str {
    match os {
        Os::Windows => "Vulkan/DX12",
        Os::MacOS | Os::iOS => "Metal",
        Os::Linux => "Vulkan",
        Os::Android => "Vulkan",
        Os::Unknown => "None",
    }
}
