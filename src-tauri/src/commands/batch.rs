//! Batch processing commands
//!
//! Provides commands for batch image processing operations.

use super::{EncodeResult, ImageData};
use crate::codecs;
use crate::commands::encode::{AvifOptions, JpegOptions, JxlOptions, PngOptions, QoiOptions, WebpOptions};
use crate::commands::process::{QuantizeOptions, ResizeOptions, RotateOptions};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

/// Batch processing job
#[derive(Debug, Clone, Deserialize)]
pub struct BatchJob {
    pub input_path: String,
    pub output_path: String,
    pub operations: Vec<BatchOperation>,
    pub encode: BatchEncodeFormat,
}

/// Batch operation
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BatchOperation {
    Resize(ResizeOptions),
    Rotate(RotateOptions),
    Quantize(QuantizeOptions),
}

/// Encoding format for batch output
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "format", rename_all = "snake_case")]
pub enum BatchEncodeFormat {
    Jpeg(JpegOptions),
    Png(PngOptions),
    Webp(WebpOptions),
    Avif(AvifOptions),
    Jxl(JxlOptions),
    Qoi(QoiOptions),
}

/// Batch processing result
#[derive(Debug, Clone, Serialize)]
pub struct BatchResult {
    pub input_path: String,
    pub output_path: String,
    pub success: bool,
    pub error: Option<String>,
    pub input_size: Option<u64>,
    pub output_size: Option<u64>,
}

/// Process multiple images in batch
#[tauri::command]
pub async fn batch_process(
    state: State<'_, AppState>,
    jobs: Vec<BatchJob>,
) -> Result<Vec<BatchResult>, String> {
    let gpu = state.gpu.clone();

    // Process jobs concurrently with bounded parallelism
    let results = futures::future::join_all(
        jobs.into_iter().map(|job| {
            let gpu = gpu.clone();
            async move {
                process_single_job(&job, &gpu).await
            }
        })
    ).await;

    Ok(results)
}

/// Batch encode multiple images (already decoded)
#[tauri::command]
pub async fn batch_encode(
    images: Vec<ImageData>,
    format: BatchEncodeFormat,
) -> Result<Vec<EncodeResult>, String> {
    let results = futures::future::join_all(
        images.into_iter().map(|image| {
            let format = format.clone();
            async move {
                encode_with_format(image, &format).await
            }
        })
    ).await;

    results.into_iter().collect()
}

/// Process a single batch job
async fn process_single_job(
    job: &BatchJob,
    gpu: &Option<std::sync::Arc<crate::gpu::WgpuBackend>>,
) -> BatchResult {
    let input_path = PathBuf::from(&job.input_path);
    let output_path = PathBuf::from(&job.output_path);

    // Get input file size
    let input_size = std::fs::metadata(&input_path).ok().map(|m| m.len());

    // Read and decode input
    let decode_result = tokio::task::spawn_blocking({
        let path = input_path.clone();
        move || {
            let bytes = std::fs::read(&path)?;
            let img = image::load_from_memory(&bytes)?;
            let rgba = img.to_rgba8();
            let (width, height) = img.dimensions();
            Ok::<_, anyhow::Error>((width, height, rgba.into_raw()))
        }
    }).await;

    let (mut width, mut height, mut rgba) = match decode_result {
        Ok(Ok(data)) => data,
        Ok(Err(e)) => return BatchResult {
            input_path: job.input_path.clone(),
            output_path: job.output_path.clone(),
            success: false,
            error: Some(format!("Decode error: {}", e)),
            input_size,
            output_size: None,
        },
        Err(e) => return BatchResult {
            input_path: job.input_path.clone(),
            output_path: job.output_path.clone(),
            success: false,
            error: Some(format!("Task error: {}", e)),
            input_size,
            output_size: None,
        },
    };

    // Apply operations
    for op in &job.operations {
        match apply_operation(&mut rgba, &mut width, &mut height, op, gpu).await {
            Ok((new_rgba, new_w, new_h)) => {
                rgba = new_rgba;
                width = new_w;
                height = new_h;
            }
            Err(e) => return BatchResult {
                input_path: job.input_path.clone(),
                output_path: job.output_path.clone(),
                success: false,
                error: Some(format!("Processing error: {}", e)),
                input_size,
                output_size: None,
            },
        }
    }

    // Encode output
    let encode_result = encode_rgba(&rgba, width, height, &job.encode).await;

    match encode_result {
        Ok(encoded) => {
            // Write output file
            let write_result = tokio::task::spawn_blocking({
                let path = output_path.clone();
                let data = encoded;
                move || {
                    if let Some(parent) = path.parent() {
                        std::fs::create_dir_all(parent)?;
                    }
                    std::fs::write(&path, &data)?;
                    Ok::<_, std::io::Error>(data.len() as u64)
                }
            }).await;

            match write_result {
                Ok(Ok(output_size)) => BatchResult {
                    input_path: job.input_path.clone(),
                    output_path: job.output_path.clone(),
                    success: true,
                    error: None,
                    input_size,
                    output_size: Some(output_size),
                },
                Ok(Err(e)) => BatchResult {
                    input_path: job.input_path.clone(),
                    output_path: job.output_path.clone(),
                    success: false,
                    error: Some(format!("Write error: {}", e)),
                    input_size,
                    output_size: None,
                },
                Err(e) => BatchResult {
                    input_path: job.input_path.clone(),
                    output_path: job.output_path.clone(),
                    success: false,
                    error: Some(format!("Task error: {}", e)),
                    input_size,
                    output_size: None,
                },
            }
        }
        Err(e) => BatchResult {
            input_path: job.input_path.clone(),
            output_path: job.output_path.clone(),
            success: false,
            error: Some(format!("Encode error: {}", e)),
            input_size,
            output_size: None,
        },
    }
}

/// Apply a single operation to image data
async fn apply_operation(
    rgba: &mut Vec<u8>,
    width: &mut u32,
    height: &mut u32,
    op: &BatchOperation,
    _gpu: &Option<std::sync::Arc<crate::gpu::WgpuBackend>>,
) -> Result<(Vec<u8>, u32, u32), String> {
    let input = std::mem::take(rgba);
    let w = *width;
    let h = *height;

    match op {
        BatchOperation::Resize(options) => {
            let opts = options.clone();
            tokio::task::spawn_blocking(move || {
                crate::commands::process::cpu_resize(&input, w, h, &opts)
                    .map(|img| {
                        let data = img.to_rgba().unwrap();
                        (data, img.width, img.height)
                    })
            })
            .await
            .map_err(|e| format!("Task error: {}", e))?
        }
        BatchOperation::Rotate(options) => {
            let opts = options.clone();
            tokio::task::spawn_blocking(move || {
                crate::commands::process::cpu_rotate(&input, w, h, &opts)
                    .map(|img| {
                        let data = img.to_rgba().unwrap();
                        (data, img.width, img.height)
                    })
            })
            .await
            .map_err(|e| format!("Task error: {}", e))?
        }
        BatchOperation::Quantize(options) => {
            let opts = options.clone();
            tokio::task::spawn_blocking(move || {
                crate::commands::process::cpu_quantize(&input, w, h, &opts)
                    .map(|img| {
                        let data = img.to_rgba().unwrap();
                        (data, img.width, img.height)
                    })
            })
            .await
            .map_err(|e| format!("Task error: {}", e))?
        }
    }
}

/// Encode RGBA data with specified format
async fn encode_rgba(
    rgba: &[u8],
    width: u32,
    height: u32,
    format: &BatchEncodeFormat,
) -> Result<Vec<u8>, String> {
    let rgba = rgba.to_vec();

    tokio::task::spawn_blocking(move || {
        match format {
            BatchEncodeFormat::Jpeg(opts) => codecs::jpeg::encode(&rgba, width, height, opts),
            BatchEncodeFormat::Png(opts) => codecs::png::encode(&rgba, width, height, opts),
            BatchEncodeFormat::Webp(opts) => codecs::webp::encode(&rgba, width, height, opts),
            BatchEncodeFormat::Avif(opts) => codecs::avif::encode(&rgba, width, height, opts),
            BatchEncodeFormat::Jxl(opts) => codecs::jxl::encode(&rgba, width, height, opts),
            BatchEncodeFormat::Qoi(opts) => codecs::qoi::encode(&rgba, width, height, opts),
        }
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Encode ImageData with specified format (for batch_encode command)
async fn encode_with_format(
    image: ImageData,
    format: &BatchEncodeFormat,
) -> Result<EncodeResult, String> {
    let rgba = image.to_rgba().map_err(|e| format!("Invalid image data: {}", e))?;
    let width = image.width;
    let height = image.height;

    let data = encode_rgba(&rgba, width, height, format).await?;

    let mime_type = match format {
        BatchEncodeFormat::Jpeg(_) => "image/jpeg",
        BatchEncodeFormat::Png(_) => "image/png",
        BatchEncodeFormat::Webp(_) => "image/webp",
        BatchEncodeFormat::Avif(_) => "image/avif",
        BatchEncodeFormat::Jxl(_) => "image/jxl",
        BatchEncodeFormat::Qoi(_) => "image/qoi",
    };

    Ok(EncodeResult::new(data, mime_type))
}

use image::GenericImageView;
