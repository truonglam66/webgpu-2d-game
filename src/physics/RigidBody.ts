/** Physics state for a single axis-aligned entity. */
export interface RigidBody {
  x: number        // top-left X (world)
  y: number        // top-left Y (world)
  vx: number       // horizontal velocity (px/s)
  vy: number       // vertical velocity (px/s, positive = down)
  width: number    // bounding-box width (px)
  height: number   // bounding-box height (px)
  onGround: boolean
  gravityScale: number
}

export function createRigidBody(
  x: number,
  y: number,
  width: number,
  height: number,
): RigidBody {
  return { x, y, vx: 0, vy: 0, width, height, onGround: false, gravityScale: 1 }
}
