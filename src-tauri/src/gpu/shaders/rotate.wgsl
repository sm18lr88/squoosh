// Rotate compute shader
// Supports 90, 180, 270 degree rotations

struct Uniforms {
    src_width: u32,
    src_height: u32,
    dst_width: u32,
    dst_height: u32,
    angle: u32, // 0=none, 1=90, 2=180, 3=270
    _padding: vec3<u32>,
}

@group(0) @binding(0) var src_texture: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(1) var dst_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dst_pos = vec2<u32>(global_id.xy);

    // Bounds check
    if dst_pos.x >= uniforms.dst_width || dst_pos.y >= uniforms.dst_height {
        return;
    }

    // Calculate source position based on rotation angle
    var src_pos: vec2<i32>;

    switch uniforms.angle {
        case 0u: { // No rotation
            src_pos = vec2<i32>(dst_pos);
        }
        case 1u: { // 90 degrees clockwise
            // dst(x, y) <- src(y, width - 1 - x)
            src_pos = vec2<i32>(
                i32(dst_pos.y),
                i32(uniforms.src_width) - 1 - i32(dst_pos.x)
            );
        }
        case 2u: { // 180 degrees
            // dst(x, y) <- src(width - 1 - x, height - 1 - y)
            src_pos = vec2<i32>(
                i32(uniforms.src_width) - 1 - i32(dst_pos.x),
                i32(uniforms.src_height) - 1 - i32(dst_pos.y)
            );
        }
        case 3u: { // 270 degrees clockwise (90 counter-clockwise)
            // dst(x, y) <- src(height - 1 - y, x)
            src_pos = vec2<i32>(
                i32(uniforms.src_height) - 1 - i32(dst_pos.y),
                i32(dst_pos.x)
            );
        }
        default: {
            src_pos = vec2<i32>(dst_pos);
        }
    }

    // Read source pixel
    let color = textureLoad(src_texture, src_pos);

    // Write to destination
    textureStore(dst_texture, vec2<i32>(dst_pos), color);
}
