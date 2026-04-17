export class Camera {
  x = 0 // world X of viewport top-left
  y = 0 // world Y of viewport top-left
  width: number
  height: number

  private readonly LERP = 6 // smoothing factor (higher = snappier)

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  /**
   * Smoothly follow a world-space center point, clamped to world bounds.
   * @param cx  target center X (world)
   * @param cy  target center Y (world)
   */
  follow(cx: number, cy: number, worldW: number, worldH: number, dt: number): void {
    const targetX = cx - this.width / 2
    const targetY = cy - this.height / 2

    const t = Math.min(this.LERP * dt, 1)
    this.x += (targetX - this.x) * t
    this.y += (targetY - this.y) * t

    // Clamp to world bounds
    this.x = Math.max(0, Math.min(this.x, worldW - this.width))
    this.y = Math.max(0, Math.min(this.y, worldH - this.height))
  }

  /** Convert world-space coordinates to screen-space. */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.x, y: wy - this.y }
  }

  /** Update viewport size when canvas is resized. */
  resize(w: number, h: number): void {
    this.width = w
    this.height = h
  }

  /** Returns true if a world-space rect is (partially) visible. */
  isVisible(wx: number, wy: number, w: number, h: number): boolean {
    return (
      wx + w > this.x &&
      wx < this.x + this.width &&
      wy + h > this.y &&
      wy < this.y + this.height
    )
  }
}
