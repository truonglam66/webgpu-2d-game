/**
 * PipelineCache — compile-once, reuse-many pipeline manager
 *
 * WebGPU shader compilation is expensive. This cache ensures each unique
 * pipeline (identified by a string label/key) is compiled exactly once per
 * device lifetime. On device recovery, call `invalidate()` to flush and
 * recompile everything on next access.
 *
 * Usage:
 *   const pipeline = cache.getRender('sprite', () => device.createRenderPipeline(...))
 *   const compute  = cache.getCompute('particles', () => device.createComputePipeline(...))
 */

import { GPUContext } from './GPUContext'

export class PipelineCache {
  private renderPipelines  = new Map<string, GPURenderPipeline>()
  private computePipelines = new Map<string, GPUComputePipeline>()
  private shaderModules    = new Map<string, GPUShaderModule>()

  constructor(private readonly ctx: GPUContext) {
    // Invalidate cache when device is recovered
    ctx.onRecover(async () => { this.invalidate() })
  }

  // ── Render pipelines ─────────────────────────────────────────────────────

  /**
   * Returns a cached render pipeline. If not cached, calls `factory()` to
   * create it, stores the result, then returns it.
   */
  getRender(
    key: string,
    factory: () => GPURenderPipeline,
  ): GPURenderPipeline {
    let pipeline = this.renderPipelines.get(key)
    if (!pipeline) {
      pipeline = factory()
      this.renderPipelines.set(key, pipeline)
      console.debug(`[PipelineCache] Compiled render pipeline: "${key}"`)
    }
    return pipeline
  }

  /**
   * Async variant — uses createRenderPipelineAsync for non-blocking compilation.
   * Preferred for pipelines not needed in the first frame.
   */
  async getRenderAsync(
    key: string,
    factory: () => Promise<GPURenderPipeline>,
  ): Promise<GPURenderPipeline> {
    let pipeline = this.renderPipelines.get(key)
    if (!pipeline) {
      pipeline = await factory()
      this.renderPipelines.set(key, pipeline)
      console.debug(`[PipelineCache] Compiled render pipeline (async): "${key}"`)
    }
    return pipeline
  }

  // ── Compute pipelines ────────────────────────────────────────────────────

  getCompute(
    key: string,
    factory: () => GPUComputePipeline,
  ): GPUComputePipeline {
    let pipeline = this.computePipelines.get(key)
    if (!pipeline) {
      pipeline = factory()
      this.computePipelines.set(key, pipeline)
      console.debug(`[PipelineCache] Compiled compute pipeline: "${key}"`)
    }
    return pipeline
  }

  async getComputeAsync(
    key: string,
    factory: () => Promise<GPUComputePipeline>,
  ): Promise<GPUComputePipeline> {
    let pipeline = this.computePipelines.get(key)
    if (!pipeline) {
      pipeline = await factory()
      this.computePipelines.set(key, pipeline)
      console.debug(`[PipelineCache] Compiled compute pipeline (async): "${key}"`)
    }
    return pipeline
  }

  // ── Shader modules ───────────────────────────────────────────────────────

  /**
   * Compile a WGSL shader module, cached by key.
   * Attach a compilation info check in debug mode to catch WGSL errors early.
   */
  getShader(key: string, code: string): GPUShaderModule {
    let mod = this.shaderModules.get(key)
    if (!mod) {
      mod = this.ctx.device.createShaderModule({ label: key, code })
      // Non-blocking shader compile error check
      void mod.getCompilationInfo().then((info) => {
        const errors = info.messages.filter((m) => m.type === 'error')
        if (errors.length > 0) {
          console.error(`[PipelineCache] WGSL errors in "${key}":`)
          for (const e of errors) {
            console.error(`  Line ${e.lineNum}:${e.linePos} — ${e.message}`)
          }
        }
      })
      this.shaderModules.set(key, mod)
    }
    return mod
  }

  // ── Cache management ─────────────────────────────────────────────────────

  /** Drop all cached pipelines (call after device recovery or hot-reload). */
  invalidate(): void {
    const rCount = this.renderPipelines.size
    const cCount = this.computePipelines.size
    this.renderPipelines.clear()
    this.computePipelines.clear()
    this.shaderModules.clear()
    console.info(`[PipelineCache] Invalidated ${rCount} render + ${cCount} compute pipelines.`)
  }

  get stats(): { renderPipelines: number; computePipelines: number; shaderModules: number } {
    return {
      renderPipelines:  this.renderPipelines.size,
      computePipelines: this.computePipelines.size,
      shaderModules:    this.shaderModules.size,
    }
  }
}
