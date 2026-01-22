// Quantize compute shader
// Performs color quantization with optional dithering
// Note: This is a simplified GPU-based quantization for preview/speed
// Full quality quantization uses imagequant on CPU

struct Uniforms {
    width: u32,
    height: u32,
    colors: u32,
    dither: f32,
}

@group(0) @binding(0) var src_texture: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(1) var dst_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// Simple hash for dithering noise
fn hash(p: vec2<u32>) -> f32 {
    var n = p.x + p.y * 57u;
    n = (n << 13u) ^ n;
    n = n * (n * n * 15731u + 789221u) + 1376312589u;
    return f32(n & 0x7fffffffu) / f32(0x7fffffff);
}

// Ordered dithering matrix (Bayer 4x4)
fn bayer_dither(pos: vec2<u32>) -> f32 {
    let bayer: array<f32, 16> = array<f32, 16>(
        0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
        12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
        3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
        15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
    );
    let idx = (pos.y % 4u) * 4u + (pos.x % 4u);
    return bayer[idx] - 0.5;
}

// Quantize a single channel value to specified number of levels
fn quantize_channel(value: f32, levels: f32, dither: f32) -> f32 {
    let quantized = floor(value * levels + 0.5 + dither) / levels;
    return clamp(quantized, 0.0, 1.0);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pos = vec2<u32>(global_id.xy);

    // Bounds check
    if pos.x >= uniforms.width || pos.y >= uniforms.height {
        return;
    }

    // Read source pixel
    let color = textureLoad(src_texture, vec2<i32>(pos));

    // Calculate levels per channel based on total colors
    // Assuming roughly equal distribution across RGB channels
    // For N colors: levels = cube_root(N)
    let levels = pow(f32(uniforms.colors), 1.0/3.0);

    // Calculate dither value
    var dither_value: f32 = 0.0;
    if uniforms.dither > 0.0 {
        dither_value = bayer_dither(pos) * uniforms.dither / levels;
    }

    // Quantize each channel
    let quantized = vec4<f32>(
        quantize_channel(color.r, levels, dither_value),
        quantize_channel(color.g, levels, dither_value),
        quantize_channel(color.b, levels, dither_value),
        color.a // Preserve alpha
    );

    // Write to destination
    textureStore(dst_texture, vec2<i32>(pos), quantized);
}
