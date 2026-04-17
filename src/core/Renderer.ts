import spriteWGSL from '../shaders/sprite.wgsl?raw'
import { GPUContext } from './GPUContext'
import { PipelineCache } from './PipelineCache'
import { ortho } from './Math2D'

// ── Instance layout (bytes) ────────────────────────────────────────────────
// pos(8) + size(8) + uvOffset(8) + uvSize(8) + color(16) + rotation(4) + pad(4)
// Total: 56 bytes — aligned to 8 bytes
export const INSTANCE_STRIDE = 56

export interface SpriteInstance {
  x: number
  y: number
  w: number
  h: number
  uvOffsetX: number
  uvOffsetY: number
  uvSizeX: number
  uvSizeY: number
  r: number
  g: number
  b: number
  a: number
  rotation: number
}

export class Renderer {
  readonly ctx: GPUContext
  private cache: PipelineCache
  private pipeline!: GPURenderPipeline

  // Bind group layouts — stored so TextureAtlas can create compatible groups
  private cameraBindGroupLayout!: GPUBindGroupLayout
  readonly textureBindGroupLayout!: GPUBindGroupLayout

  private cameraBuffer!: GPUBuffer
  private cameraBindGroup!: GPUBindGroup
  private quadVB!: GPUBuffer
  private quadIB!: GPUBuffer
  private instanceBuffer!: GPUBuffer
  private instanceData!: Float32Array
  private maxInstances: number
  private instanceCount = 0
  private defaultTextureBindGroup!: GPUBindGroup

  // Active texture for the current batch (can be swapped per draw group)
  private activeTextureBindGroup!: GPUBindGroup

  constructor(ctx: GPUContext, cache: PipelineCache, maxInstances = 8192) {
    this.ctx = ctx
    this.cache = cache
    this.maxInstances = maxInstances
    this.build()
  }

  // ── Construction ──────────────────────────────────────────────────────────

  private build(): void {
    const device = this.ctx.device

    // Capture any validation error during resource creation so we get
    // the actual message instead of downstream "invalid due to previous error".
    device.pushErrorScope('validation')

    this.buildLayouts()
    this.buildPipeline()
    this.createQuad()
    this.createInstanceBuffer()
    this.createCameraUniform()
    this.createDefaultTexture()
    this.activeTextureBindGroup = this.defaultTextureBindGroup

    void device.popErrorScope().then((error) => {
      if (error) {
        console.error('[Renderer] Build error (root cause):', error.message)
      }
    })
  }

  private buildLayouts(): void {
    const device = this.ctx.device

    this.cameraBindGroupLayout = device.createBindGroupLayout({
      label: 'camera-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      }],
    })

    // Cast to silence readonly assignment in constructor
    ;(this as { textureBindGroupLayout: GPUBindGroupLayout }).textureBindGroupLayout =
      device.createBindGroupLayout({
        label: 'texture-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        ],
      })
  }

  private buildPipeline(): void {
    const device = this.ctx.device
    const shaderModule = this.cache.getShader('sprite', spriteWGSL)

    const pipelineLayout = device.createPipelineLayout({
      label: 'sprite-pipeline-layout',
      bindGroupLayouts: [this.cameraBindGroupLayout, this.textureBindGroupLayout],
    })

    this.pipeline = this.cache.getRender('sprite', () =>
      device.createRenderPipeline({
        label: 'sprite-render-pipeline',
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [
            // slot 0: unit quad (per-vertex)
            {
              arrayStride: 16,
              stepMode: 'vertex',
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
                { shaderLocation: 1, offset: 8, format: 'float32x2' }, // uv
              ],
            },
            // slot 1: instance data (per-instance)
            {
              arrayStride: INSTANCE_STRIDE,
              stepMode: 'instance',
              attributes: [
                { shaderLocation: 2, offset: 0,  format: 'float32x2' }, // pos
                { shaderLocation: 3, offset: 8,  format: 'float32x2' }, // size
                { shaderLocation: 4, offset: 16, format: 'float32x2' }, // uvOffset
                { shaderLocation: 5, offset: 24, format: 'float32x2' }, // uvSize
                { shaderLocation: 6, offset: 32, format: 'float32x4' }, // color
                { shaderLocation: 7, offset: 48, format: 'float32'   }, // rotation
              ],
            },
          ],
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: this.ctx.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          }],
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
      })
    )
  }

  private createQuad(): void {
    // Unit quad centered at origin: positions + UVs
    // top-left(-0.5, 0.5) → top-right(0.5, 0.5) → bot-left(-0.5,-0.5) → bot-right(0.5,-0.5)
    const verts = new Float32Array([
      -0.5,  0.5,  0.0, 0.0,
       0.5,  0.5,  1.0, 0.0,
      -0.5, -0.5,  0.0, 1.0,
       0.5, -0.5,  1.0, 1.0,
    ])
    this.quadVB = this.ctx.device.createBuffer({
      label: 'quad-vertex-buffer',
      size: verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.ctx.device.queue.writeBuffer(this.quadVB, 0, verts)

    const indices = new Uint16Array([0, 2, 1, 1, 2, 3])
    this.quadIB = this.ctx.device.createBuffer({
      label: 'quad-index-buffer',
      // GPUBuffer size must be a multiple of 4
      size: Math.ceil(indices.byteLength / 4) * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    })
    this.ctx.device.queue.writeBuffer(this.quadIB, 0, indices)
  }

  private createInstanceBuffer(): void {
    this.instanceData = new Float32Array(this.maxInstances * (INSTANCE_STRIDE / 4))
    this.instanceBuffer = this.ctx.device.createBuffer({
      label: 'instance-buffer',
      size: this.instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
  }

  private createCameraUniform(): void {
    // mat4x4<f32> = 64 bytes
    this.cameraBuffer = this.ctx.device.createBuffer({
      label: 'camera-uniform',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.cameraBindGroup = this.ctx.device.createBindGroup({
      label: 'camera-bind-group',
      layout: this.cameraBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    })
    this.uploadCameraMatrix()
  }

  private uploadCameraMatrix(): void {
    const { width, height } = this.ctx.canvas
    const proj = ortho(0, width, height, 0)
    this.ctx.device.queue.writeBuffer(this.cameraBuffer, 0, proj.buffer)
  }

  private createDefaultTexture(): void {
    // 2×2 white texture — used for solid-color sprites (no atlas needed)
    const tex = this.ctx.device.createTexture({
      label: 'default-white-texture',
      size: [2, 2],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
    this.ctx.device.queue.writeTexture(
      { texture: tex },
      new Uint8Array([255,255,255,255, 255,255,255,255, 255,255,255,255, 255,255,255,255]),
      { bytesPerRow: 8 },
      [2, 2],
    )
    // linear filter = "filtering sampler" required by textureSample + default
    // sampler layout (type: 'filtering'). For pixel-art sprite sheets, a
    // dedicated nearest-filter pipeline will be created when atlas is loaded.
    const sampler = this.ctx.device.createSampler({
      label: 'default-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
    })
    this.defaultTextureBindGroup = this.ctx.device.createBindGroup({
      label: 'default-texture-bind-group',
      layout: this.textureBindGroupLayout,
      entries: [
        { binding: 0, resource: tex.createView() },
        { binding: 1, resource: sampler },
      ],
    })
  }

  // ── Texture management ────────────────────────────────────────────────────

  /** Load an image URL into a GPU texture and return its bind group. */
  async loadTexture(
    url: string,
    filter: GPUFilterMode = 'nearest',
  ): Promise<GPUBindGroup> {
    const response = await fetch(url)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' })

    const tex = this.ctx.device.createTexture({
      label: `texture:${url}`,
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    })
    this.ctx.device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: tex, colorSpace: 'srgb' },
      [bitmap.width, bitmap.height],
    )
    bitmap.close()

    const sampler = this.ctx.device.createSampler({
      label: `sampler:${url}`,
      magFilter: filter,
      minFilter: filter,
      mipmapFilter: 'nearest',
    })
    return this.ctx.device.createBindGroup({
      label: `texture-bg:${url}`,
      layout: this.textureBindGroupLayout,
      entries: [
        { binding: 0, resource: tex.createView() },
        { binding: 1, resource: sampler },
      ],
    })
  }

  /** Switch the active texture atlas for subsequent drawSprite() calls. */
  useTexture(bindGroup: GPUBindGroup): void {
    this.activeTextureBindGroup = bindGroup
  }

  /** Reset to the default white texture. */
  useDefaultTexture(): void {
    this.activeTextureBindGroup = this.defaultTextureBindGroup
  }

  // ── Frame API ─────────────────────────────────────────────────────────────

  beginFrame(): void {
    this.instanceCount = 0
    // Re-upload projection in case canvas was resized
    this.uploadCameraMatrix()
  }

  /** Queue one sprite instance for batch rendering. */
  drawSprite(s: SpriteInstance): void {
    if (this.instanceCount >= this.maxInstances) {
      console.warn('[Renderer] Instance buffer full — increase maxInstances')
      return
    }
    const base = this.instanceCount * (INSTANCE_STRIDE / 4)
    const d = this.instanceData
    d[base +  0] = s.x;        d[base +  1] = s.y
    d[base +  2] = s.w;        d[base +  3] = s.h
    d[base +  4] = s.uvOffsetX; d[base +  5] = s.uvOffsetY
    d[base +  6] = s.uvSizeX;   d[base +  7] = s.uvSizeY
    d[base +  8] = s.r;         d[base +  9] = s.g
    d[base + 10] = s.b;         d[base + 11] = s.a
    d[base + 12] = s.rotation
    this.instanceCount++
  }

  endFrame(clearColor: GPUColor = { r: 0.04, g: 0.04, b: 0.06, a: 1 }): void {
    const encoder = this.ctx.createEncoder('main-pass')

    const pass = encoder.beginRenderPass({
      label: 'sprite-pass',
      colorAttachments: [{
        view: this.ctx.canvasContext.getCurrentTexture().createView(),
        clearValue: clearColor,
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })

    if (this.instanceCount > 0) {
      this.ctx.device.queue.writeBuffer(
        this.instanceBuffer, 0,
        this.instanceData.buffer, 0,
        this.instanceCount * INSTANCE_STRIDE,
      )

      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, this.cameraBindGroup)
      pass.setBindGroup(1, this.activeTextureBindGroup)
      pass.setVertexBuffer(0, this.quadVB)
      pass.setVertexBuffer(1, this.instanceBuffer)
      pass.setIndexBuffer(this.quadIB, 'uint16')
      pass.drawIndexed(6, this.instanceCount)
    }

    pass.end()
    this.ctx.device.queue.submit([encoder.finish()])
  }

  /** Current number of draw instances this frame (for HUD/debug). */
  get instancesThisFrame(): number { return this.instanceCount }
}
