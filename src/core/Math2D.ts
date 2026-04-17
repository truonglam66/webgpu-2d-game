export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y })

export function rectOverlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Build an orthographic projection matrix (column-major, NDC [-1,1]) */
export function ortho(
  left: number, right: number,
  bottom: number, top: number,
  near = -1, far = 1
): Float32Array {
  const lr = 1 / (left - right)
  const bt = 1 / (bottom - top)
  const nf = 1 / (near - far)
  return new Float32Array([
    -2 * lr,       0,           0,      0,
     0,           -2 * bt,      0,      0,
     0,            0,       2 * nf,     0,
    (left + right) * lr, (top + bottom) * bt, (near + far) * nf, 1,
  ])
}
