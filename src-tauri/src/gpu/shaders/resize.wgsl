// Resize compute shader
// Supports multiple interpolation methods: nearest, bilinear, catmull-rom, mitchell, lanczos3

struct Uniforms {
    src_width: u32,
    src_height: u32,
    dst_width: u32,
    dst_height: u32,
    method: u32, // 0=nearest, 1=bilinear, 2=catmull-rom, 3=mitchell, 4=lanczos3
    _padding: vec3<u32>,
}

@group(0) @binding(0) var src_texture: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(1) var dst_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

const PI: f32 = 3.14159265358979323846;

// Sinc function
fn sinc(x: f32) -> f32 {
    if abs(x) < 0.0001 {
        return 1.0;
    }
    let px = PI * x;
    return sin(px) / px;
}

// Lanczos3 kernel
fn lanczos3(x: f32) -> f32 {
    if abs(x) >= 3.0 {
        return 0.0;
    }
    return sinc(x) * sinc(x / 3.0);
}

// Mitchell-Netravali kernel (B=1/3, C=1/3)
fn mitchell(x: f32) -> f32 {
    let B: f32 = 1.0 / 3.0;
    let C: f32 = 1.0 / 3.0;
    let ax = abs(x);

    if ax < 1.0 {
        return ((12.0 - 9.0 * B - 6.0 * C) * ax * ax * ax +
                (-18.0 + 12.0 * B + 6.0 * C) * ax * ax +
                (6.0 - 2.0 * B)) / 6.0;
    } else if ax < 2.0 {
        return ((-B - 6.0 * C) * ax * ax * ax +
                (6.0 * B + 30.0 * C) * ax * ax +
                (-12.0 * B - 48.0 * C) * ax +
                (8.0 * B + 24.0 * C)) / 6.0;
    }
    return 0.0;
}

// Catmull-Rom kernel (B=0, C=0.5)
fn catmull_rom(x: f32) -> f32 {
    let ax = abs(x);

    if ax < 1.0 {
        return (1.5 * ax * ax * ax - 2.5 * ax * ax + 1.0);
    } else if ax < 2.0 {
        return (-0.5 * ax * ax * ax + 2.5 * ax * ax - 4.0 * ax + 2.0);
    }
    return 0.0;
}

// Sample with clamping
fn sample_clamped(pos: vec2<i32>) -> vec4<f32> {
    let clamped = vec2<i32>(
        clamp(pos.x, 0, i32(uniforms.src_width) - 1),
        clamp(pos.y, 0, i32(uniforms.src_height) - 1)
    );
    return textureLoad(src_texture, clamped);
}

// Nearest neighbor sampling
fn sample_nearest(uv: vec2<f32>) -> vec4<f32> {
    let pos = vec2<i32>(i32(uv.x + 0.5), i32(uv.y + 0.5));
    return sample_clamped(pos);
}

// Bilinear sampling
fn sample_bilinear(uv: vec2<f32>) -> vec4<f32> {
    let pos = floor(uv);
    let frac = uv - pos;
    let ipos = vec2<i32>(pos);

    let tl = sample_clamped(ipos);
    let tr = sample_clamped(ipos + vec2<i32>(1, 0));
    let bl = sample_clamped(ipos + vec2<i32>(0, 1));
    let br = sample_clamped(ipos + vec2<i32>(1, 1));

    let top = mix(tl, tr, frac.x);
    let bottom = mix(bl, br, frac.x);

    return mix(top, bottom, frac.y);
}

// Cubic sampling (generic for different kernels)
fn sample_cubic(uv: vec2<f32>, method: u32) -> vec4<f32> {
    let pos = floor(uv);
    let frac = uv - pos;
    let ipos = vec2<i32>(pos);

    var color = vec4<f32>(0.0);
    var weight_sum: f32 = 0.0;

    // Sample 4x4 grid
    for (var y: i32 = -1; y <= 2; y++) {
        for (var x: i32 = -1; x <= 2; x++) {
            let sample_pos = ipos + vec2<i32>(x, y);
            let sample_color = sample_clamped(sample_pos);

            var wx: f32;
            var wy: f32;

            if method == 2u { // Catmull-Rom
                wx = catmull_rom(frac.x - f32(x));
                wy = catmull_rom(frac.y - f32(y));
            } else { // Mitchell (method == 3)
                wx = mitchell(frac.x - f32(x));
                wy = mitchell(frac.y - f32(y));
            }

            let w = wx * wy;
            color += sample_color * w;
            weight_sum += w;
        }
    }

    if weight_sum > 0.0 {
        color /= weight_sum;
    }

    return clamp(color, vec4<f32>(0.0), vec4<f32>(1.0));
}

// Lanczos3 sampling
fn sample_lanczos3(uv: vec2<f32>) -> vec4<f32> {
    let pos = floor(uv);
    let frac = uv - pos;
    let ipos = vec2<i32>(pos);

    var color = vec4<f32>(0.0);
    var weight_sum: f32 = 0.0;

    // Sample 6x6 grid for Lanczos3
    for (var y: i32 = -2; y <= 3; y++) {
        for (var x: i32 = -2; x <= 3; x++) {
            let sample_pos = ipos + vec2<i32>(x, y);
            let sample_color = sample_clamped(sample_pos);

            let wx = lanczos3(frac.x - f32(x));
            let wy = lanczos3(frac.y - f32(y));
            let w = wx * wy;

            color += sample_color * w;
            weight_sum += w;
        }
    }

    if weight_sum > 0.0 {
        color /= weight_sum;
    }

    return clamp(color, vec4<f32>(0.0), vec4<f32>(1.0));
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dst_pos = vec2<u32>(global_id.xy);

    // Bounds check
    if dst_pos.x >= uniforms.dst_width || dst_pos.y >= uniforms.dst_height {
        return;
    }

    // Calculate source position
    let scale_x = f32(uniforms.src_width) / f32(uniforms.dst_width);
    let scale_y = f32(uniforms.src_height) / f32(uniforms.dst_height);
    let src_uv = vec2<f32>(
        (f32(dst_pos.x) + 0.5) * scale_x - 0.5,
        (f32(dst_pos.y) + 0.5) * scale_y - 0.5
    );

    // Sample based on method
    var color: vec4<f32>;

    switch uniforms.method {
        case 0u: { // Nearest
            color = sample_nearest(src_uv);
        }
        case 1u: { // Bilinear
            color = sample_bilinear(src_uv);
        }
        case 2u, 3u: { // Catmull-Rom, Mitchell
            color = sample_cubic(src_uv, uniforms.method);
        }
        case 4u: { // Lanczos3
            color = sample_lanczos3(src_uv);
        }
        default: {
            color = sample_bilinear(src_uv);
        }
    }

    textureStore(dst_texture, vec2<i32>(dst_pos), color);
}
