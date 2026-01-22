//! Squoosh library for mobile platforms (iOS/Android)
//!
//! This module provides the entry point for Tauri mobile builds.

mod commands;
mod codecs;
mod gpu;
mod platform;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging for mobile
    #[cfg(target_os = "android")]
    android_logger::init_once(
        android_logger::Config::default()
            .with_max_level(log::LevelFilter::Info)
            .with_tag("Squoosh"),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize app state with GPU backend
            let state = AppState::new();

            if let Some(ref gpu) = state.gpu {
                log::info!("GPU backend initialized: {}", gpu.device_info());
            } else {
                log::info!("GPU acceleration not available, using CPU fallback");
            }

            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Codec commands
            commands::encode::encode_jpeg,
            commands::encode::encode_png,
            commands::encode::encode_webp,
            commands::encode::encode_avif,
            commands::encode::encode_jxl,
            commands::encode::encode_qoi,
            commands::encode::encode_browser_png,
            commands::encode::encode_browser_jpeg,
            // Decode commands
            commands::decode::decode_image,
            commands::decode::get_image_info,
            // Processing commands
            commands::process::resize_image,
            commands::process::rotate_image,
            commands::process::quantize_image,
            // File operations
            commands::file_ops::read_file_as_image,
            commands::file_ops::save_image_to_file,
            // Batch operations
            commands::batch::batch_process,
            commands::batch::batch_encode,
            // Platform info
            commands::platform_info,
            commands::gpu_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Squoosh");
}
