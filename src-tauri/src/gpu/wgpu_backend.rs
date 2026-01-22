//! wgpu-based GPU backend implementation
//!
//! Uses wgpu for cross-platform GPU acceleration (Vulkan, Metal, DX12).

use super::{GpuBackend, GpuError, GpuResult};
use crate::commands::process::{QuantizeOptions, ResizeMethod, ResizeOptions, RotateAngle, RotateOptions};
use bytemuck::{Pod, Zeroable};
use std::sync::Arc;
use wgpu::util::DeviceExt;

/// wgpu GPU backend
pub struct WgpuBackend {
    device: wgpu::Device,
    queue: wgpu::Queue,
    adapter_info: wgpu::AdapterInfo,

    // Compute pipelines
    resize_pipeline: wgpu::ComputePipeline,
    rotate_pipeline: wgpu::ComputePipeline,
    quantize_pipeline: wgpu::ComputePipeline,

    // Bind group layouts
    resize_bind_group_layout: wgpu::BindGroupLayout,
    rotate_bind_group_layout: wgpu::BindGroupLayout,
    quantize_bind_group_layout: wgpu::BindGroupLayout,
}

/// Uniform data for resize shader
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct ResizeUniforms {
    src_width: u32,
    src_height: u32,
    dst_width: u32,
    dst_height: u32,
    method: u32,
    _padding: [u32; 3],
}

/// Uniform data for rotate shader
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct RotateUniforms {
    src_width: u32,
    src_height: u32,
    dst_width: u32,
    dst_height: u32,
    angle: u32,
    _padding: [u32; 3],
}

/// Uniform data for quantize shader
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct QuantizeUniforms {
    width: u32,
    height: u32,
    colors: u32,
    dither: f32,
}

impl WgpuBackend {
    /// Create a new wgpu backend
    pub fn new() -> Option<Arc<Self>> {
        pollster::block_on(Self::new_async())
    }

    /// Async initialization
    async fn new_async() -> Option<Arc<Self>> {
        // Create instance with all available backends
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        // Request adapter with high performance preference
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await?;

        let adapter_info = adapter.get_info();

        log::info!(
            "GPU adapter: {} ({:?})",
            adapter_info.name,
            adapter_info.backend
        );

        // Request device with required features
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Squoosh GPU Device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    memory_hints: wgpu::MemoryHints::Performance,
                },
                None,
            )
            .await
            .ok()?;

        // Create shader modules
        let resize_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Resize Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/resize.wgsl").into()),
        });

        let rotate_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Rotate Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/rotate.wgsl").into()),
        });

        let quantize_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Quantize Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/quantize.wgsl").into()),
        });

        // Create bind group layouts
        let resize_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Resize Bind Group Layout"),
            entries: &[
                // Source texture
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadOnly,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Destination texture
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::WriteOnly,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                // Uniforms
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let rotate_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Rotate Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadOnly,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::WriteOnly,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let quantize_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Quantize Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::ReadOnly,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::StorageTexture {
                        access: wgpu::StorageTextureAccess::WriteOnly,
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        view_dimension: wgpu::TextureViewDimension::D2,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        // Create pipeline layouts
        let resize_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Resize Pipeline Layout"),
            bind_group_layouts: &[&resize_bind_group_layout],
            push_constant_ranges: &[],
        });

        let rotate_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Rotate Pipeline Layout"),
            bind_group_layouts: &[&rotate_bind_group_layout],
            push_constant_ranges: &[],
        });

        let quantize_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Quantize Pipeline Layout"),
            bind_group_layouts: &[&quantize_bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create compute pipelines
        let resize_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Resize Pipeline"),
            layout: Some(&resize_pipeline_layout),
            module: &resize_shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        let rotate_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Rotate Pipeline"),
            layout: Some(&rotate_pipeline_layout),
            module: &rotate_shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        let quantize_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Quantize Pipeline"),
            layout: Some(&quantize_pipeline_layout),
            module: &quantize_shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        Some(Arc::new(Self {
            device,
            queue,
            adapter_info,
            resize_pipeline,
            rotate_pipeline,
            quantize_pipeline,
            resize_bind_group_layout,
            rotate_bind_group_layout,
            quantize_bind_group_layout,
        }))
    }

    /// Create texture from RGBA data
    fn create_texture(&self, width: u32, height: u32, data: Option<&[u8]>) -> wgpu::Texture {
        let texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Image Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING
                | wgpu::TextureUsages::COPY_SRC
                | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        if let Some(data) = data {
            self.queue.write_texture(
                wgpu::ImageCopyTexture {
                    texture: &texture,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                data,
                wgpu::ImageDataLayout {
                    offset: 0,
                    bytes_per_row: Some(width * 4),
                    rows_per_image: Some(height),
                },
                wgpu::Extent3d {
                    width,
                    height,
                    depth_or_array_layers: 1,
                },
            );
        }

        texture
    }

    /// Read texture data back to CPU
    fn read_texture(&self, texture: &wgpu::Texture, width: u32, height: u32) -> Vec<u8> {
        let buffer_size = (width * height * 4) as u64;
        let padded_bytes_per_row = (width * 4 + 255) & !255;
        let buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Read Buffer"),
            size: padded_bytes_per_row as u64 * height as u64,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Read Encoder"),
        });

        encoder.copy_texture_to_buffer(
            wgpu::ImageCopyTexture {
                texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            wgpu::ImageCopyBuffer {
                buffer: &buffer,
                layout: wgpu::ImageDataLayout {
                    offset: 0,
                    bytes_per_row: Some(padded_bytes_per_row),
                    rows_per_image: Some(height),
                },
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );

        self.queue.submit(std::iter::once(encoder.finish()));

        let buffer_slice = buffer.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            tx.send(result).unwrap();
        });
        self.device.poll(wgpu::Maintain::Wait);
        rx.recv().unwrap().unwrap();

        let data = buffer_slice.get_mapped_range();

        // Remove row padding
        let mut result = Vec::with_capacity(buffer_size as usize);
        for row in 0..height {
            let start = (row * padded_bytes_per_row) as usize;
            let end = start + (width * 4) as usize;
            result.extend_from_slice(&data[start..end]);
        }

        result
    }
}

impl GpuBackend for WgpuBackend {
    fn device_info(&self) -> String {
        format!(
            "{} ({:?})",
            self.adapter_info.name,
            self.adapter_info.backend
        )
    }

    fn backend_name(&self) -> String {
        format!("{:?}", self.adapter_info.backend)
    }

    fn device_name(&self) -> String {
        self.adapter_info.name.clone()
    }

    fn vendor(&self) -> Option<String> {
        Some(format!("{}", self.adapter_info.vendor))
    }

    fn driver_info(&self) -> Option<String> {
        Some(self.adapter_info.driver_info.clone())
    }

    fn resize(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
        options: &ResizeOptions,
    ) -> GpuResult<(u32, u32, Vec<u8>)> {
        let dst_width = options.width;
        let dst_height = options.height;

        // Create textures
        let src_texture = self.create_texture(width, height, Some(rgba));
        let dst_texture = self.create_texture(dst_width, dst_height, None);

        // Create uniform buffer
        let method = match options.method {
            ResizeMethod::Nearest => 0,
            ResizeMethod::Bilinear | ResizeMethod::Triangle => 1,
            ResizeMethod::CatmullRom => 2,
            ResizeMethod::Mitchell => 3,
            ResizeMethod::Lanczos3 => 4,
        };

        let uniforms = ResizeUniforms {
            src_width: width,
            src_height: height,
            dst_width,
            dst_height,
            method,
            _padding: [0; 3],
        };

        let uniform_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Resize Uniforms"),
            contents: bytemuck::bytes_of(&uniforms),
            usage: wgpu::BufferUsages::UNIFORM,
        });

        // Create bind group
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Resize Bind Group"),
            layout: &self.resize_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(
                        &src_texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(
                        &dst_texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: uniform_buffer.as_entire_binding(),
                },
            ],
        });

        // Dispatch compute
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Resize Encoder"),
        });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Resize Pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(&self.resize_pipeline);
            compute_pass.set_bind_group(0, &bind_group, &[]);
            compute_pass.dispatch_workgroups(
                (dst_width + 15) / 16,
                (dst_height + 15) / 16,
                1,
            );
        }

        self.queue.submit(std::iter::once(encoder.finish()));

        // Read result
        let result = self.read_texture(&dst_texture, dst_width, dst_height);

        Ok((dst_width, dst_height, result))
    }

    fn rotate(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
        options: &RotateOptions,
    ) -> GpuResult<(u32, u32, Vec<u8>)> {
        let (dst_width, dst_height, angle) = match options.angle {
            RotateAngle::None => return Ok((width, height, rgba.to_vec())),
            RotateAngle::Rotate90 => (height, width, 1u32),
            RotateAngle::Rotate180 => (width, height, 2u32),
            RotateAngle::Rotate270 => (height, width, 3u32),
        };

        // Create textures
        let src_texture = self.create_texture(width, height, Some(rgba));
        let dst_texture = self.create_texture(dst_width, dst_height, None);

        // Create uniform buffer
        let uniforms = RotateUniforms {
            src_width: width,
            src_height: height,
            dst_width,
            dst_height,
            angle,
            _padding: [0; 3],
        };

        let uniform_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Rotate Uniforms"),
            contents: bytemuck::bytes_of(&uniforms),
            usage: wgpu::BufferUsages::UNIFORM,
        });

        // Create bind group
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Rotate Bind Group"),
            layout: &self.rotate_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(
                        &src_texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(
                        &dst_texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: uniform_buffer.as_entire_binding(),
                },
            ],
        });

        // Dispatch compute
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Rotate Encoder"),
        });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Rotate Pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(&self.rotate_pipeline);
            compute_pass.set_bind_group(0, &bind_group, &[]);
            compute_pass.dispatch_workgroups(
                (dst_width + 15) / 16,
                (dst_height + 15) / 16,
                1,
            );
        }

        self.queue.submit(std::iter::once(encoder.finish()));

        // Read result
        let result = self.read_texture(&dst_texture, dst_width, dst_height);

        Ok((dst_width, dst_height, result))
    }

    fn quantize(
        &self,
        rgba: &[u8],
        width: u32,
        height: u32,
        options: &QuantizeOptions,
    ) -> GpuResult<(u32, u32, Vec<u8>)> {
        // Create textures
        let src_texture = self.create_texture(width, height, Some(rgba));
        let dst_texture = self.create_texture(width, height, None);

        // Create uniform buffer
        let uniforms = QuantizeUniforms {
            width,
            height,
            colors: options.colors,
            dither: options.dither,
        };

        let uniform_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Quantize Uniforms"),
            contents: bytemuck::bytes_of(&uniforms),
            usage: wgpu::BufferUsages::UNIFORM,
        });

        // Create bind group
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Quantize Bind Group"),
            layout: &self.quantize_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(
                        &src_texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(
                        &dst_texture.create_view(&wgpu::TextureViewDescriptor::default()),
                    ),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: uniform_buffer.as_entire_binding(),
                },
            ],
        });

        // Dispatch compute
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Quantize Encoder"),
        });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Quantize Pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(&self.quantize_pipeline);
            compute_pass.set_bind_group(0, &bind_group, &[]);
            compute_pass.dispatch_workgroups(
                (width + 15) / 16,
                (height + 15) / 16,
                1,
            );
        }

        self.queue.submit(std::iter::once(encoder.finish()));

        // Read result
        let result = self.read_texture(&dst_texture, width, height);

        Ok((width, height, result))
    }
}
