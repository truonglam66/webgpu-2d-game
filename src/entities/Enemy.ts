import { Renderer } from '../core/Renderer'
import type { Vec2 } from '../core/Math2D'

const ENEMY_SPEED = 80

export class Enemy {
  pos: Vec2
  w = 28
  h = 28
  hp: number

  constructor(x: number, y: number, hp = 1) {
    this.pos = { x, y }
    this.hp = hp
  }

  update(dt: number, target: Vec2): void {
    const dx = target.x - this.pos.x
    const dy = target.y - this.pos.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    this.pos.x += (dx / len) * ENEMY_SPEED * dt
    this.pos.y += (dy / len) * ENEMY_SPEED * dt
  }

  draw(renderer: Renderer): void {
    const hh = this.h / 2  // 14

    // Body — dark crimson
    renderer.drawSprite({
      x: this.pos.x, y: this.pos.y,
      w: this.w, h: this.h,
      uvOffsetX: 0, uvOffsetY: 0, uvSizeX: 1, uvSizeY: 1,
      r: 0.72, g: 0.08, b: 0.08, a: 1,
      rotation: 0,
    })

    // Eye — glowing yellow, upper-center of body
    renderer.drawSprite({
      x: this.pos.x, y: this.pos.y - hh * 0.35,
      w: 8, h: 6,
      uvOffsetX: 0, uvOffsetY: 0, uvSizeX: 1, uvSizeY: 1,
      r: 1.0, g: 0.85, b: 0.10, a: 1,
      rotation: 0,
    })

    // Horn — orange spike on top
    renderer.drawSprite({
      x: this.pos.x, y: this.pos.y - hh - 4,
      w: 6, h: 8,
      uvOffsetX: 0, uvOffsetY: 0, uvSizeX: 1, uvSizeY: 1,
      r: 0.90, g: 0.35, b: 0.05, a: 1,
      rotation: 0,
    })
  }
}
