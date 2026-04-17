import type { RigidBody } from './RigidBody'
import type { Tilemap } from '../world/Tilemap'

const GRAVITY = 900        // px/s²
const MAX_FALL_SPEED = 1400 // terminal velocity (px/s)

export class PhysicsWorld {
  /**
   * Integrate one physics step for a single body against the tilemap.
   * Order: gravity → move X → resolve X → move Y → resolve Y
   */
  update(body: RigidBody, tilemap: Tilemap, dt: number): void {
    // Gravity
    body.vy = Math.min(body.vy + GRAVITY * body.gravityScale * dt, MAX_FALL_SPEED)

    // Horizontal movement + collision
    body.x += body.vx * dt
    this.resolveX(body, tilemap)

    // Vertical movement + collision (onGround reset here)
    body.onGround = false
    body.y += body.vy * dt
    this.resolveY(body, tilemap)
  }

  // ── Private collision resolution ──────────────────────────────────────────

  /**
   * Resolve X-axis overlap with solid tiles.
   * Only checks the leading edge (right if vx>0, left if vx<0).
   */
  private resolveX(body: RigidBody, tilemap: Tilemap): void {
    const ts = tilemap.tileSize
    // Use the last interior pixel (height-1) so a body sitting exactly on a tile
    // boundary does not count as overlapping the tile below.
    const topTile = Math.floor(body.y / ts)
    const botTile = Math.floor((body.y + body.height - 1) / ts)

    if (body.vx > 0) {
      // Check tile the right edge has entered
      const rightTile = Math.floor((body.x + body.width) / ts)
      for (let ty = topTile; ty <= botTile; ty++) {
        if (tilemap.isSolid(rightTile, ty)) {
          body.x = rightTile * ts - body.width
          body.vx = 0
          return
        }
      }
    } else if (body.vx < 0) {
      const leftTile = Math.floor(body.x / ts)
      for (let ty = topTile; ty <= botTile; ty++) {
        if (tilemap.isSolid(leftTile, ty)) {
          body.x = (leftTile + 1) * ts
          body.vx = 0
          return
        }
      }
    }
  }

  /**
   * Resolve Y-axis overlap with solid tiles.
   * Sets body.onGround = true when landing on top of a tile.
   */
  private resolveY(body: RigidBody, tilemap: Tilemap): void {
    const ts = tilemap.tileSize
    const leftTile  = Math.floor(body.x / ts)
    const rightTile = Math.floor((body.x + body.width - 1) / ts)

    if (body.vy >= 0) {
      // Check tile the bottom edge has entered
      const botTile = Math.floor((body.y + body.height) / ts)
      for (let tx = leftTile; tx <= rightTile; tx++) {
        if (tilemap.isSolid(tx, botTile)) {
          body.y = botTile * ts - body.height
          body.vy = 0
          body.onGround = true
          return
        }
      }
    } else {
      // Moving up — check top edge row
      const topTile = Math.floor(body.y / ts)
      for (let tx = leftTile; tx <= rightTile; tx++) {
        if (tilemap.isSolid(tx, topTile)) {
          body.y = (topTile + 1) * ts
          body.vy = 0
          return
        }
      }
    }
  }
}
