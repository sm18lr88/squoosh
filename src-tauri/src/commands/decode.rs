//! Image decoding commands
//!
//! Provides Tauri commands for decoding images from various formats.

use super::ImageData;
use image::{DynamicImage, GenericImageView, ImageFormat};
use serde::Serialize;

/// Image information returned by get_image_info
#[derive(Debug, Clone, Serialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub format: Option<String>,
    pub color_type: String,
    pub has_alpha: bool,
    pub bit_depth: u8,
}

/// Decode an image from raw bytes
#[tauri::command]
pub async fn decode_image(data: String) -> Result<ImageData, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| format!("Invalid base64 data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        // Try to detect format and decode
        let img = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode image: {}", e))?;

        let rgba = img.to_rgba8();
        let (width, height) = img.dimensions();

        Ok(ImageData::from_rgba(width, height, rgba.as_raw()))
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Get image information without fully decoding
#[tauri::command]
pub async fn get_image_info(data: String) -> Result<ImageInfo, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| format!("Invalid base64 data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        // Detect format
        let format = image::guess_format(&bytes).ok();
        let format_str = format.map(|f| format_to_string(f));

        // Load image to get full info
        let img = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode image: {}", e))?;

        let (width, height) = img.dimensions();
        let (color_type, has_alpha, bit_depth) = color_info(&img);

        Ok(ImageInfo {
            width,
            height,
            format: format_str,
            color_type,
            has_alpha,
            bit_depth,
        })
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Convert ImageFormat to string
fn format_to_string(format: ImageFormat) -> String {
    match format {
        ImageFormat::Png => "png".to_string(),
        ImageFormat::Jpeg => "jpeg".to_string(),
        ImageFormat::Gif => "gif".to_string(),
        ImageFormat::WebP => "webp".to_string(),
        ImageFormat::Avif => "avif".to_string(),
        ImageFormat::Bmp => "bmp".to_string(),
        ImageFormat::Ico => "ico".to_string(),
        ImageFormat::Tiff => "tiff".to_string(),
        ImageFormat::Tga => "tga".to_string(),
        ImageFormat::Qoi => "qoi".to_string(),
        _ => "unknown".to_string(),
    }
}

/// Get color type info from DynamicImage
fn color_info(img: &DynamicImage) -> (String, bool, u8) {
    match img {
        DynamicImage::ImageLuma8(_) => ("grayscale".to_string(), false, 8),
        DynamicImage::ImageLumaA8(_) => ("grayscale".to_string(), true, 8),
        DynamicImage::ImageRgb8(_) => ("rgb".to_string(), false, 8),
        DynamicImage::ImageRgba8(_) => ("rgba".to_string(), true, 8),
        DynamicImage::ImageLuma16(_) => ("grayscale".to_string(), false, 16),
        DynamicImage::ImageLumaA16(_) => ("grayscale".to_string(), true, 16),
        DynamicImage::ImageRgb16(_) => ("rgb".to_string(), false, 16),
        DynamicImage::ImageRgba16(_) => ("rgba".to_string(), true, 16),
        DynamicImage::ImageRgb32F(_) => ("rgb".to_string(), false, 32),
        DynamicImage::ImageRgba32F(_) => ("rgba".to_string(), true, 32),
        _ => ("unknown".to_string(), false, 8),
    }
}
