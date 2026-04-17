// ── Uniforms ─────────────────────────────────────────────────────────────────
struct Camera {
  projection: mat4x4<f32>,
}
@group(0) @binding(0) var<uniform> camera: Camera;

// ── Per-instance data (vertex buffer, step mode = instance) ──────────────────
struct Instance {
  @location(2) pos:      vec2<f32>,  // world position
  @location(3) size:     vec2<f32>,  // width, height
  @location(4) uvOffset: vec2<f32>,  // UV atlas offset (0..1)
  @location(5) uvSize:   vec2<f32>,  // UV atlas size   (0..1)
  @location(6) color:    vec4<f32>,  // tint / solid color
  @location(7) rotation: f32,        // radians
}

// ── Vertex input (unit quad) ──────────────────────────────────────────────────
struct VertexIn {
  @location(0) position: vec2<f32>,
  @location(1) uv:       vec2<f32>,
}

struct VertexOut {
  @builtin(position) clip: vec4<f32>,
  @location(0)       uv:   vec2<f32>,
  @location(1)       tint: vec4<f32>,
}

// ── Vertex shader ─────────────────────────────────────────────────────────────
@vertex
fn vs_main(v: VertexIn, inst: Instance) -> VertexOut {
  let c = cos(inst.rotation);
  let s = sin(inst.rotation);

  // scale then rotate the unit quad vertex
  let local = vec2<f32>(
    v.position.x * inst.size.x,
    v.position.y * inst.size.y,
  );
  let rotated = vec2<f32>(
    local.x * c - local.y * s,
    local.x * s + local.y * c,
  );
  let world = rotated + inst.pos;

  var out: VertexOut;
  out.clip = camera.projection * vec4<f32>(world, 0.0, 1.0);
  out.uv   = inst.uvOffset + v.uv * inst.uvSize;
  out.tint = inst.color;
  return out;
}

// ── Texture & sampler ─────────────────────────────────────────────────────────
@group(1) @binding(0) var spriteTexture: texture_2d<f32>;
@group(1) @binding(1) var spriteSampler: sampler;

// ── Fragment shader ───────────────────────────────────────────────────────────
@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let texColor = textureSample(spriteTexture, spriteSampler, in.uv);
  // Multiply texture by tint; if alpha < 0.01 discard (transparency)
  let finalColor = texColor * in.tint;
  if (finalColor.a < 0.01) { discard; }
  return finalColor;
}
