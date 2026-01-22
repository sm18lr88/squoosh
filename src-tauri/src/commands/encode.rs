//! Image encoding commands
//!
//! Provides Tauri commands for encoding images to various formats.

use super::{EncodeResult, ImageData};
use crate::codecs;
use serde::Deserialize;

/// JPEG encoding options (matches mozjpeg options from frontend)
#[derive(Debug, Clone, Deserialize)]
pub struct JpegOptions {
    #[serde(default = "default_jpeg_quality")]
    pub quality: u8,
    #[serde(default)]
    pub baseline: bool,
    #[serde(default = "default_true")]
    pub arithmetic: bool,
    #[serde(default = "default_true")]
    pub progressive: bool,
    #[serde(default = "default_true")]
    pub optimize_coding: bool,
    #[serde(default)]
    pub smoothing: u8,
    #[serde(default = "default_color_space")]
    pub color_space: u8,
    #[serde(default = "default_quant_table")]
    pub quant_table: u8,
    #[serde(default)]
    pub trellis_multipass: bool,
    #[serde(default)]
    pub trellis_opt_zero: bool,
    #[serde(default)]
    pub trellis_opt_table: bool,
    #[serde(default = "default_trellis_loops")]
    pub trellis_loops: u8,
    #[serde(default)]
    pub auto_subsample: bool,
    #[serde(default = "default_chroma_subsample")]
    pub chroma_subsample: u8,
    #[serde(default)]
    pub separate_chroma_quality: bool,
    #[serde(default = "default_jpeg_quality")]
    pub chroma_quality: u8,
}

fn default_jpeg_quality() -> u8 { 75 }
fn default_true() -> bool { true }
fn default_color_space() -> u8 { 3 } // YCbCr
fn default_quant_table() -> u8 { 3 } // ImageMagick
fn default_trellis_loops() -> u8 { 1 }
fn default_chroma_subsample() -> u8 { 2 }

impl Default for JpegOptions {
    fn default() -> Self {
        Self {
            quality: default_jpeg_quality(),
            baseline: false,
            arithmetic: true,
            progressive: true,
            optimize_coding: true,
            smoothing: 0,
            color_space: default_color_space(),
            quant_table: default_quant_table(),
            trellis_multipass: false,
            trellis_opt_zero: false,
            trellis_opt_table: false,
            trellis_loops: default_trellis_loops(),
            auto_subsample: false,
            chroma_subsample: default_chroma_subsample(),
            separate_chroma_quality: false,
            chroma_quality: default_jpeg_quality(),
        }
    }
}

/// PNG encoding options (matches oxipng options from frontend)
#[derive(Debug, Clone, Deserialize)]
pub struct PngOptions {
    #[serde(default = "default_png_level")]
    pub level: u8,
    #[serde(default = "default_true")]
    pub interlace: bool,
}

fn default_png_level() -> u8 { 2 }

impl Default for PngOptions {
    fn default() -> Self {
        Self {
            level: default_png_level(),
            interlace: true,
        }
    }
}

/// WebP encoding options
#[derive(Debug, Clone, Deserialize)]
pub struct WebpOptions {
    #[serde(default = "default_webp_quality")]
    pub quality: f32,
    #[serde(default = "default_webp_target_size")]
    pub target_size: u32,
    #[serde(default = "default_webp_target_psnr")]
    pub target_psnr: f32,
    #[serde(default = "default_webp_method")]
    pub method: u8,
    #[serde(default)]
    pub sns_strength: u8,
    #[serde(default = "default_webp_filter_strength")]
    pub filter_strength: u8,
    #[serde(default = "default_webp_filter_sharpness")]
    pub filter_sharpness: u8,
    #[serde(default)]
    pub filter_type: u8,
    #[serde(default = "default_webp_partitions")]
    pub partitions: u8,
    #[serde(default = "default_webp_segments")]
    pub segments: u8,
    #[serde(default = "default_webp_pass")]
    pub pass: u8,
    #[serde(default)]
    pub show_compressed: bool,
    #[serde(default)]
    pub preprocessing: u8,
    #[serde(default)]
    pub autofilter: bool,
    #[serde(default)]
    pub partition_limit: u8,
    #[serde(default = "default_webp_alpha_compression")]
    pub alpha_compression: bool,
    #[serde(default = "default_webp_alpha_filtering")]
    pub alpha_filtering: u8,
    #[serde(default = "default_webp_alpha_quality")]
    pub alpha_quality: u8,
    #[serde(default)]
    pub lossless: bool,
    #[serde(default)]
    pub near_lossless: u8,
    #[serde(default)]
    pub exact: bool,
    #[serde(default)]
    pub image_hint: u8,
    #[serde(default)]
    pub emulate_jpeg_size: bool,
    #[serde(default)]
    pub thread_level: bool,
    #[serde(default)]
    pub low_memory: bool,
}

fn default_webp_quality() -> f32 { 75.0 }
fn default_webp_target_size() -> u32 { 0 }
fn default_webp_target_psnr() -> f32 { 0.0 }
fn default_webp_method() -> u8 { 4 }
fn default_webp_filter_strength() -> u8 { 60 }
fn default_webp_filter_sharpness() -> u8 { 0 }
fn default_webp_partitions() -> u8 { 0 }
fn default_webp_segments() -> u8 { 4 }
fn default_webp_pass() -> u8 { 1 }
fn default_webp_alpha_compression() -> bool { true }
fn default_webp_alpha_filtering() -> u8 { 1 }
fn default_webp_alpha_quality() -> u8 { 100 }

impl Default for WebpOptions {
    fn default() -> Self {
        Self {
            quality: default_webp_quality(),
            target_size: default_webp_target_size(),
            target_psnr: default_webp_target_psnr(),
            method: default_webp_method(),
            sns_strength: 0,
            filter_strength: default_webp_filter_strength(),
            filter_sharpness: default_webp_filter_sharpness(),
            filter_type: 0,
            partitions: default_webp_partitions(),
            segments: default_webp_segments(),
            pass: default_webp_pass(),
            show_compressed: false,
            preprocessing: 0,
            autofilter: false,
            partition_limit: 0,
            alpha_compression: default_webp_alpha_compression(),
            alpha_filtering: default_webp_alpha_filtering(),
            alpha_quality: default_webp_alpha_quality(),
            lossless: false,
            near_lossless: 0,
            exact: false,
            image_hint: 0,
            emulate_jpeg_size: false,
            thread_level: false,
            low_memory: false,
        }
    }
}

/// AVIF encoding options
#[derive(Debug, Clone, Deserialize)]
pub struct AvifOptions {
    #[serde(default = "default_avif_cq_level")]
    pub cq_level: u8,
    #[serde(default = "default_avif_cq_alpha_level")]
    pub cq_alpha_level: i8,
    #[serde(default)]
    pub denoising_level: u8,
    #[serde(default)]
    pub tune: u8,
    #[serde(default)]
    pub tile_cols_log2: u8,
    #[serde(default)]
    pub tile_rows_log2: u8,
    #[serde(default = "default_avif_speed")]
    pub speed: u8,
    #[serde(default)]
    pub subsample: u8,
    #[serde(default)]
    pub chroma_delta_q: bool,
    #[serde(default)]
    pub sharpness: u8,
}

fn default_avif_cq_level() -> u8 { 33 }
fn default_avif_cq_alpha_level() -> i8 { -1 }
fn default_avif_speed() -> u8 { 6 }

impl Default for AvifOptions {
    fn default() -> Self {
        Self {
            cq_level: default_avif_cq_level(),
            cq_alpha_level: default_avif_cq_alpha_level(),
            denoising_level: 0,
            tune: 0,
            tile_cols_log2: 0,
            tile_rows_log2: 0,
            speed: default_avif_speed(),
            subsample: 0,
            chroma_delta_q: false,
            sharpness: 0,
        }
    }
}

/// JXL (JPEG XL) encoding options
#[derive(Debug, Clone, Deserialize)]
pub struct JxlOptions {
    #[serde(default = "default_jxl_quality")]
    pub quality: f32,
    #[serde(default = "default_jxl_effort")]
    pub effort: u8,
    #[serde(default)]
    pub progressive: bool,
    #[serde(default = "default_jxl_epf")]
    pub epf: i8,
    #[serde(default)]
    pub lossless_jpeg: bool,
    #[serde(default)]
    pub near_lossless: u8,
    #[serde(default)]
    pub near_lossless_quality: u8,
}

fn default_jxl_quality() -> f32 { 75.0 }
fn default_jxl_effort() -> u8 { 7 }
fn default_jxl_epf() -> i8 { -1 }

impl Default for JxlOptions {
    fn default() -> Self {
        Self {
            quality: default_jxl_quality(),
            effort: default_jxl_effort(),
            progressive: false,
            epf: default_jxl_epf(),
            lossless_jpeg: false,
            near_lossless: 0,
            near_lossless_quality: 0,
        }
    }
}

/// QOI encoding options (minimal)
#[derive(Debug, Clone, Deserialize, Default)]
pub struct QoiOptions {}

/// Encode image to JPEG using mozjpeg
#[tauri::command]
pub async fn encode_jpeg(image: ImageData, options: JpegOptions) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        codecs::jpeg::encode(&rgba, image.width, image.height, &options)
            .map(|data| EncodeResult::new(data, "image/jpeg"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Encode image to PNG using oxipng
#[tauri::command]
pub async fn encode_png(image: ImageData, options: PngOptions) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        codecs::png::encode(&rgba, image.width, image.height, &options)
            .map(|data| EncodeResult::new(data, "image/png"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Encode image to WebP using libwebp
#[tauri::command]
pub async fn encode_webp(image: ImageData, options: WebpOptions) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        codecs::webp::encode(&rgba, image.width, image.height, &options)
            .map(|data| EncodeResult::new(data, "image/webp"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Encode image to AVIF using ravif
#[tauri::command]
pub async fn encode_avif(image: ImageData, options: AvifOptions) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        codecs::avif::encode(&rgba, image.width, image.height, &options)
            .map(|data| EncodeResult::new(data, "image/avif"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Encode image to JXL
#[tauri::command]
pub async fn encode_jxl(image: ImageData, options: JxlOptions) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        codecs::jxl::encode(&rgba, image.width, image.height, &options)
            .map(|data| EncodeResult::new(data, "image/jxl"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Encode image to QOI
#[tauri::command]
pub async fn encode_qoi(image: ImageData, options: QoiOptions) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        codecs::qoi::encode(&rgba, image.width, image.height, &options)
            .map(|data| EncodeResult::new(data, "image/qoi"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Browser-compatible PNG encoding (simpler, faster)
#[tauri::command]
pub async fn encode_browser_png(image: ImageData) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        codecs::png::encode_simple(&rgba, image.width, image.height)
            .map(|data| EncodeResult::new(data, "image/png"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Browser-compatible JPEG encoding (simpler options)
#[tauri::command]
pub async fn encode_browser_jpeg(image: ImageData, quality: u8) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        codecs::jpeg::encode_simple(&rgba, image.width, image.height, quality)
            .map(|data| EncodeResult::new(data, "image/jpeg"))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}
