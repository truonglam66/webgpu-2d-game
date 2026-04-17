import { GPUContext } from './core/GPUContext'
import { PipelineCache } from './core/PipelineCache'
import { Renderer } from './core/Renderer'
import { Game } from './core/Game'

async function main(): Promise<void> {
  const canvas  = document.getElementById('canvas') as HTMLCanvasElement
  const errorEl = document.getElementById('error') as HTMLDivElement

  // ── 1. WebGPU Context (adapter + device + canvas context) ─────────────────
  let gpuCtx: GPUContext
  try {
    gpuCtx = await GPUContext.init(canvas, {
      powerPreference: 'high-performance',
    })
  } catch (err) {
    showError(errorEl, err)
    return
  }

  // ── 2. Pipeline Cache (compile-once WGSL shaders) ─────────────────────────
  const pipelineCache = new PipelineCache(gpuCtx)

  // ── 3. Renderer (sprite batcher) ──────────────────────────────────────────
  const renderer = new Renderer(gpuCtx, pipelineCache)

  // ── 4. Game (logic loop) ──────────────────────────────────────────────────
  const game = new Game(renderer)

  // Re-init game resources if device is ever recovered
  gpuCtx.onRecover(async () => {
    game.stop()
    // Renderer will rebuild via PipelineCache.invalidate()
    game.start()
  })

  // ── 5. Responsive canvas ──────────────────────────────────────────────────
  const resizeObserver = new ResizeObserver((entries) => {
    // Use the entry's content box size (CSS pixels) — never read canvas.clientWidth
    // after canvas.width was modified, to avoid the feedback loop where setting
    // canvas.width changes clientWidth → triggers another resize → exponential growth.
    const entry = entries[0]
    if (!entry) return
    const dpr = window.devicePixelRatio ?? 1
    const cssW = entry.contentRect.width
    const cssH = entry.contentRect.height
    const w = Math.floor(cssW * dpr)
    const h = Math.floor(cssH * dpr)
    if (w < 1 || h < 1 || w > 8192 || h > 8192) return
    if (w !== canvas.width || h !== canvas.height) {
      gpuCtx.resize(w, h)
    }
  })
  resizeObserver.observe(canvas)

  game.start()
}

function showError(el: HTMLDivElement, err: unknown): void {
  el.style.display = 'block'
  el.textContent = err instanceof Error ? err.message : String(err)
  console.error('[main] Fatal error:', err)
}

main().catch((err: unknown) => {
  const el = document.getElementById('error') as HTMLDivElement
  showError(el, err)
})
