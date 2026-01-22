//! File operation commands
//!
//! Provides Tauri commands for reading and writing image files.

use super::ImageData;
use std::path::PathBuf;

/// Read an image file and decode it
#[tauri::command]
pub async fn read_file_as_image(path: String) -> Result<ImageData, String> {
    let path = PathBuf::from(path);

    tokio::task::spawn_blocking(move || {
        // Read file
        let bytes = std::fs::read(&path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // Decode image
        let img = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode image: {}", e))?;

        let rgba = img.to_rgba8();
        let (width, height) = img.dimensions();

        Ok(ImageData::from_rgba(width, height, rgba.as_raw()))
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Save encoded image data to a file
#[tauri::command]
pub async fn save_image_to_file(path: String, data: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let path = PathBuf::from(path);
    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| format!("Invalid base64 data: {}", e))?;

    tokio::task::spawn_blocking(move || {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        // Write file
        std::fs::write(&path, &bytes)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

use image::GenericImageView;
