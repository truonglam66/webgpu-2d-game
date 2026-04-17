import type { Input } from '../core/Input'
import type { Renderer } from '../core/Renderer'
import type { Camera } from '../core/Camera'
import type { Tilemap } from '../world/Tilemap'
import type { PhysicsWorld } from '../physics/World'
import { createRigidBody, type RigidBody } from '../physics/RigidBody'

const WALK_SPEED   = 240  // px/s horizontal
const JUMP_SPEED   = 540  // px/s upward on jump
const COYOTE_TIME  = 0.10 // seconds of jump grace after leaving a ledge
const JUMP_BUFFER  = 0.12 // seconds a queued jump is remembered
const CUT_GRAVITY  = 700  // extra downward accel when jump held is released early

export class Player {
  readonly body: RigidBody

  private facingRight = true
  private coyoteTimer   = 0
  private jumpBuffer    = 0

  constructor(x: number, y: number) {
    // Body origin = top-left; size 28×36 px
    this.body = createRigidBody(x, y, 28, 36)
  }

  /** Center of the body in world space (used by Camera and HUD). */
  get pos() {
    return {
      x: this.body.x + this.body.width  / 2,
      y: this.body.y + this.body.height / 2,
    }
  }

  update(dt: number, input: Input, tilemap: Tilemap, physics: PhysicsWorld): void {
    // ── Horizontal movement ──────────────────────────────────────────────────
    let dx = 0
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) dx -= 1
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) dx += 1
    this.body.vx = dx * WALK_SPEED
    if (dx !== 0) this.facingRight = dx > 0

    // ── Coyote time (allow jumping briefly after walking off a ledge) ────────
    if (this.body.onGround) {
      this.coyoteTimer = COYOTE_TIME
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt)
    }

    // ── Jump buffer (remember a jump press just before landing) ─────────────
    const jumpPressed = input.wasJustPressed('ArrowUp')
      || input.wasJustPressed('KeyW')
      || input.wasJustPressed('Space')
    if (jumpPressed) {
      this.jumpBuffer = JUMP_BUFFER
    } else {
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt)
    }

    // ── Execute jump ─────────────────────────────────────────────────────────
    if (this.jumpBuffer > 0 && this.coyoteTimer > 0) {
      this.body.vy = -JUMP_SPEED
      this.coyoteTimer = 0
      this.jumpBuffer  = 0
    }

    // ── Variable jump height (release key early → cut apex) ─────────────────
    const jumpHeld = input.isDown('ArrowUp') || input.isDown('KeyW') || input.isDown('Space')
    if (!jumpHeld && this.body.vy < -100) {
      this.body.vy += CUT_GRAVITY * dt
    }

    // ── Physics step ─────────────────────────────────────────────────────────
    physics.update(this.body, tilemap, dt)
  }

  draw(renderer: Renderer, camera: Camera): void {
    const hw = this.body.width  / 2  // 14
    const hh = this.body.height / 2  // 18

    // Body center in screen space
    const { x: sx, y: sy } = camera.worldToScreen(
      this.body.x + hw,
      this.body.y + hh,
    )

    // Body layout (relative to center sy, body height = 36px):
    //   Head   : top 10px  → local 0–10,  center offset = -18 + 5  = -13
    //   Armor  : next 14px → local 10–24, center offset = -18 + 17 = -1
    //   Legs   : last 12px → local 24–36, center offset = -18 + 30 = +12

    // Legs — dark navy
    renderer.drawSprite({
      x: sx, y: sy + 12,
      w: 22, h: 12,
      uvOffsetX: 0, uvOffsetY: 0, uvSizeX: 1, uvSizeY: 1,
      r: 0.14, g: 0.16, b: 0.42, a: 1,
      rotation: 0,
    })

    // Armor / torso — blue steel
    renderer.drawSprite({
      x: sx, y: sy - 1,
      w: this.body.width, h: 14,
      uvOffsetX: 0, uvOffsetY: 0, uvSizeX: 1, uvSizeY: 1,
      r: 0.28, g: 0.38, b: 0.82, a: 1,
      rotation: 0,
    })

    // Head — skin tone
    renderer.drawSprite({
      x: sx, y: sy - 13,
      w: 14, h: 10,
      uvOffsetX: 0, uvOffsetY: 0, uvSizeX: 1, uvSizeY: 1,
      r: 0.95, g: 0.78, b: 0.60, a: 1,
      rotation: 0,
    })

    // Sword — gold, extends from the hand side
    const swordOffsetX = this.facingRight ? hw + 8 : -(hw + 8)
    renderer.drawSprite({
      x: sx + swordOffsetX, y: sy - 3,
      w: 4, h: 16,
      uvOffsetX: 0, uvOffsetY: 0, uvSizeX: 1, uvSizeY: 1,
      r: 0.95, g: 0.82, b: 0.20, a: 1,
      rotation: 0,
    })
  }
}
