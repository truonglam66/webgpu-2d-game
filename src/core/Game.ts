import { Renderer } from './Renderer'
import { Input } from './Input'
import { Camera } from './Camera'
import { Player } from '../entities/Player'
import { Tilemap } from '../world/Tilemap'
import { TileRenderer } from '../rendering/TileRenderer'
import { PhysicsWorld } from '../physics/World'

// Sky gradient colors (clear color for the render pass)
const SKY_COLOR: GPUColor = { r: 0.04, g: 0.07, b: 0.18, a: 1 }

export class Game {
  private renderer: Renderer
  private input: Input
  private camera: Camera
  private player: Player
  private tilemap: Tilemap
  private tileRenderer: TileRenderer
  private physics: PhysicsWorld

  private fpsEl!: HTMLElement
  private posEl!: HTMLElement
  private frameCount = 0
  private fpsTimer   = 0
  private lastTime   = 0
  private running    = false

  constructor(renderer: Renderer) {
    this.renderer    = renderer
    this.input       = new Input()
    this.physics     = new PhysicsWorld()
    this.tileRenderer = new TileRenderer()
    this.tilemap     = Tilemap.createWorldTree()

    // Player spawns on the ground, left side of the map
    // Ground row = 27 → top-left of ground = y=27*32=864
    // Player bottom must sit on ground: body.y = 864 - player.height
    const spawnX = 4 * 32          // tile column 4
    const spawnY = 27 * 32 - 36   // just above ground row 27
    this.player = new Player(spawnX, spawnY)

    // Camera viewport matches the physical canvas pixels
    const cv = renderer.ctx.canvas
    this.camera = new Camera(cv.width, cv.height)

    this.initHUD()
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private initHUD(): void {
    const hud = document.createElement('div')
    hud.style.cssText = [
      'position:fixed', 'top:8px', 'left:0', 'right:0',
      'display:flex', 'justify-content:center', 'gap:32px',
      'font:14px monospace', 'color:#adf', 'pointer-events:none',
    ].join(';')
    hud.innerHTML = [
      '<span id="fps">FPS: --</span>',
      '<span id="pos">x:0 y:0</span>',
      '<span style="opacity:0.5">A/D move · Space/W jump</span>',
    ].join('')
    document.body.appendChild(hud)
    this.fpsEl = document.getElementById('fps')!
    this.posEl = document.getElementById('pos')!
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    this.running  = true
    this.lastTime = performance.now()
    requestAnimationFrame(this.loop)
  }

  stop(): void {
    this.running = false
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  private loop = (time: number): void => {
    if (!this.running) return
    const dt = Math.min((time - this.lastTime) / 1000, 0.05)
    this.lastTime = time

    // FPS counter
    this.frameCount++
    this.fpsTimer += dt
    if (this.fpsTimer >= 1) {
      this.fpsEl.textContent = `FPS: ${this.frameCount}`
      this.frameCount = 0
      this.fpsTimer   = 0
    }

    this.update(dt)
    this.draw()

    requestAnimationFrame(this.loop)
  }

  // ── Update ────────────────────────────────────────────────────────────────

  private update(dt: number): void {
    // Sync camera viewport with canvas (handles window resize)
    const cv = this.renderer.ctx.canvas
    this.camera.resize(cv.width, cv.height)

    // Update player (physics included)
    this.player.update(dt, this.input, this.tilemap, this.physics)

    // Camera follows player center
    const p = this.player.pos
    this.camera.follow(p.x, p.y, this.tilemap.worldWidth, this.tilemap.worldHeight, dt)

    // HUD position readout (tile coordinates)
    const tx = Math.floor(p.x / this.tilemap.tileSize)
    const ty = Math.floor(p.y / this.tilemap.tileSize)
    this.posEl.textContent = `tile(${tx},${ty})`

    this.input.flush()
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  private draw(): void {
    this.renderer.beginFrame()

    // Tilemap (World Tree branches and ground)
    this.tileRenderer.render(this.tilemap, this.camera, this.renderer)

    // Player
    this.player.draw(this.renderer, this.camera)

    this.renderer.endFrame(SKY_COLOR)
  }
}
