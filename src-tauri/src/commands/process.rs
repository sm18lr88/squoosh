//! Image processing commands (resize, rotate, quantize)
//!
//! These commands support GPU acceleration when available.

use super::ImageData;
use crate::gpu::GpuBackend;
use crate::state::AppState;
use serde::Deserialize;
use tauri::State;

/// Resize filter/method options
#[derive(Debug, Clone, Copy, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ResizeMethod {
    #[default]
    Lanczos3,
    Mitchell,
    CatmullRom,
    Nearest,
    Bilinear,
    Triangle,
}

/// Resize fitting mode
#[derive(Debug, Clone, Copy, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ResizeFit {
    #[default]
    Stretch,
    Contain,
    Cover,
}

/// Resize options
#[derive(Debug, Clone, Deserialize)]
pub struct ResizeOptions {
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub method: ResizeMethod,
    #[serde(default)]
    pub fit: ResizeFit,
    #[serde(default)]
    pub premultiply: bool,
    #[serde(default)]
    pub linear_rgb: bool,
}

/// Rotation angle
#[derive(Debug, Clone, Copy, Deserialize, Default)]
pub enum RotateAngle {
    #[default]
    #[serde(rename = "0")]
    None,
    #[serde(rename = "90")]
    Rotate90,
    #[serde(rename = "180")]
    Rotate180,
    #[serde(rename = "270")]
    Rotate270,
}

/// Rotate options
#[derive(Debug, Clone, Deserialize)]
pub struct RotateOptions {
    #[serde(default)]
    pub angle: RotateAngle,
}

/// Quantize options
#[derive(Debug, Clone, Deserialize)]
pub struct QuantizeOptions {
    #[serde(default = "default_colors")]
    pub colors: u32,
    #[serde(default = "default_dither")]
    pub dither: f32,
}

fn default_colors() -> u32 { 256 }
fn default_dither() -> f32 { 1.0 }

/// Minimum pixel count to benefit from GPU acceleration
const GPU_RESIZE_THRESHOLD: u64 = 1_000_000; // 1 megapixel
const GPU_ROTATE_THRESHOLD: u64 = 500_000;   // 0.5 megapixels
const GPU_QUANTIZE_THRESHOLD: u64 = 2_000_000; // 2 megapixels

/// Resize an image
#[tauri::command]
pub async fn resize_image(
    state: State<'_, AppState>,
    image: ImageData,
    options: ResizeOptions,
) -> Result<ImageData, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;
    let pixel_count = image.pixel_count();
    let width = image.width;
    let height = image.height;

    // Decide GPU vs CPU based on image size
    let use_gpu = state.gpu.is_some() && pixel_count >= GPU_RESIZE_THRESHOLD;

    if use_gpu {
        let gpu = state.gpu.as_ref().unwrap().clone();
        tokio::task::spawn_blocking(move || {
            gpu.resize(&rgba, width, height, &options)
                .map(|(w, h, data)| ImageData::from_rgba(w, h, &data))
                .map_err(|e| format!("GPU resize failed: {}", e))
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
    } else {
        // CPU fallback using fast_image_resize
        tokio::task::spawn_blocking(move || {
            cpu_resize(&rgba, width, height, &options)
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
    }
}

/// Rotate an image
#[tauri::command]
pub async fn rotate_image(
    state: State<'_, AppState>,
    image: ImageData,
    options: RotateOptions,
) -> Result<ImageData, String> {
    // Early return for no rotation
    if matches!(options.angle, RotateAngle::None) {
        return Ok(image);
    }

    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;
    let pixel_count = image.pixel_count();
    let width = image.width;
    let height = image.height;

    let use_gpu = state.gpu.is_some() && pixel_count >= GPU_ROTATE_THRESHOLD;

    if use_gpu {
        let gpu = state.gpu.as_ref().unwrap().clone();
        tokio::task::spawn_blocking(move || {
            gpu.rotate(&rgba, width, height, &options)
                .map(|(w, h, data)| ImageData::from_rgba(w, h, &data))
                .map_err(|e| format!("GPU rotate failed: {}", e))
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
    } else {
        // CPU fallback
        tokio::task::spawn_blocking(move || {
            cpu_rotate(&rgba, width, height, &options)
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
    }
}

/// Quantize an image (reduce color palette)
#[tauri::command]
pub async fn quantize_image(
    state: State<'_, AppState>,
    image: ImageData,
    options: QuantizeOptions,
) -> Result<ImageData, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;
    let pixel_count = image.pixel_count();
    let width = image.width;
    let height = image.height;

    // Quantize typically benefits less from GPU due to palette computation
    // Use GPU only for very large images
    let use_gpu = state.gpu.is_some() && pixel_count >= GPU_QUANTIZE_THRESHOLD;

    if use_gpu {
        let gpu = state.gpu.as_ref().unwrap().clone();
        tokio::task::spawn_blocking(move || {
            gpu.quantize(&rgba, width, height, &options)
                .map(|(w, h, data)| ImageData::from_rgba(w, h, &data))
                .map_err(|e| format!("GPU quantize failed: {}", e))
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
    } else {
        // CPU fallback using imagequant
        tokio::task::spawn_blocking(move || {
            cpu_quantize(&rgba, width, height, &options)
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
    }
}

/// CPU-based resize using fast_image_resize
pub(crate) fn cpu_resize(rgba: &[u8], width: u32, height: u32, options: &ResizeOptions) -> Result<ImageData, String> {
    use fast_image_resize::{images::Image, ResizeAlg, ResizeOptions as FirOptions, Resizer, PixelType};

    // Calculate target dimensions based on fit mode
    let (target_width, target_height) = calculate_fit_dimensions(
        width, height,
        options.width, options.height,
        options.fit
    );

    // Create source image
    let src_image = Image::from_vec_u8(
        width,
        height,
        rgba.to_vec(),
        PixelType::U8x4
    ).map_err(|e| format!("Failed to create source image: {}", e))?;

    // Create destination image
    let mut dst_image = Image::new(
        target_width,
        target_height,
        PixelType::U8x4
    );

    // Select resize algorithm
    let algorithm = match options.method {
        ResizeMethod::Nearest => ResizeAlg::Nearest,
        ResizeMethod::Bilinear | ResizeMethod::Triangle => ResizeAlg::Convolution(
            fast_image_resize::FilterType::Bilinear
        ),
        ResizeMethod::CatmullRom => ResizeAlg::Convolution(
            fast_image_resize::FilterType::CatmullRom
        ),
        ResizeMethod::Mitchell => ResizeAlg::Convolution(
            fast_image_resize::FilterType::Mitchell
        ),
        ResizeMethod::Lanczos3 => ResizeAlg::Convolution(
            fast_image_resize::FilterType::Lanczos3
        ),
    };

    // Perform resize
    let mut resizer = Resizer::new();
    let resize_options = FirOptions::new().resize_alg(algorithm);

    resizer.resize(&src_image, &mut dst_image, &resize_options)
        .map_err(|e| format!("Resize failed: {}", e))?;

    Ok(ImageData::from_rgba(target_width, target_height, dst_image.buffer()))
}

/// CPU-based rotate using image crate
pub(crate) fn cpu_rotate(rgba: &[u8], width: u32, height: u32, options: &RotateOptions) -> Result<ImageData, String> {
    use image::{ImageBuffer, Rgba};

    let img: ImageBuffer<Rgba<u8>, _> = ImageBuffer::from_raw(width, height, rgba.to_vec())
        .ok_or("Failed to create image buffer")?;

    let rotated = match options.angle {
        RotateAngle::None => img,
        RotateAngle::Rotate90 => image::imageops::rotate90(&img),
        RotateAngle::Rotate180 => image::imageops::rotate180(&img),
        RotateAngle::Rotate270 => image::imageops::rotate270(&img),
    };

    let (new_width, new_height) = rotated.dimensions();
    Ok(ImageData::from_rgba(new_width, new_height, rotated.as_raw()))
}

/// CPU-based quantize using imagequant
pub(crate) fn cpu_quantize(rgba: &[u8], width: u32, height: u32, options: &QuantizeOptions) -> Result<ImageData, String> {
    use imagequant::{Attributes, RGBA};

    // Create quantizer attributes
    let mut attr = Attributes::new();
    attr.set_max_colors(options.colors as u32)
        .map_err(|e| format!("Invalid color count: {}", e))?;

    // Convert to RGBA pixels
    let pixels: Vec<RGBA> = rgba
        .chunks_exact(4)
        .map(|c| RGBA::new(c[0], c[1], c[2], c[3]))
        .collect();

    // Create image for quantization
    let mut img = attr.new_image_borrowed(&pixels, width as usize, height as usize, 0.0)
        .map_err(|e| format!("Failed to create quantize image: {}", e))?;

    // Quantize
    let mut result = attr.quantize(&mut img)
        .map_err(|e| format!("Quantization failed: {}", e))?;

    // Set dithering level
    result.set_dithering_level(options.dither)
        .map_err(|e| format!("Invalid dither level: {}", e))?;

    // Remap pixels
    let (palette, pixels) = result.remapped(&mut img)
        .map_err(|e| format!("Remapping failed: {}", e))?;

    // Convert indexed back to RGBA
    let output: Vec<u8> = pixels
        .iter()
        .flat_map(|&idx| {
            let c = &palette[idx as usize];
            [c.r, c.g, c.b, c.a]
        })
        .collect();

    Ok(ImageData::from_rgba(width, height, &output))
}

/// Calculate dimensions based on fit mode
fn calculate_fit_dimensions(
    src_width: u32, src_height: u32,
    dst_width: u32, dst_height: u32,
    fit: ResizeFit
) -> (u32, u32) {
    match fit {
        ResizeFit::Stretch => (dst_width, dst_height),
        ResizeFit::Contain => {
            let scale = f64::min(
                dst_width as f64 / src_width as f64,
                dst_height as f64 / src_height as f64
            );
            (
                (src_width as f64 * scale).round() as u32,
                (src_height as f64 * scale).round() as u32
            )
        }
        ResizeFit::Cover => {
            let scale = f64::max(
                dst_width as f64 / src_width as f64,
                dst_height as f64 / src_height as f64
            );
            (
                (src_width as f64 * scale).round() as u32,
                (src_height as f64 * scale).round() as u32
            )
        }
    }
}
