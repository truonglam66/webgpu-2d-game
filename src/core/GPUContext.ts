/**
 * GPUContext — WebGPU boilerplate layer
 *
 * Owns: GPUAdapter, GPUDevice, GPUCanvasContext, preferred format.
 * Responsibilities:
 *   - Adapter/device initialization with M1-friendly options
 *   - Device-lost detection and auto-recovery
 *   - Uncaptured GPU error logging (validation + out-of-memory)
 *   - Canvas context configuration
 *   - Adapter info reporting for debug
 */

export interface GPUContextOptions {
  /** Request the discrete or high-performance GPU (default: high-performance) */
  powerPreference?: GPUPowerPreference
  /** Extra required features, e.g. 'timestamp-query' for GPU profiling */
  requiredFeatures?: GPUFeatureName[]
  /** Override specific device limits */
  requiredLimits?: Record<string, number>
}

export class GPUContext {
  readonly adapter: GPUAdapter
  readonly device: GPUDevice
  readonly canvas: HTMLCanvasElement
  readonly canvasContext: GPUCanvasContext
  readonly format: GPUTextureFormat

  /** Human-readable GPU info — useful when debugging on M1 vs. other hardware */
  readonly adapterInfo: {
    vendor: string
    architecture: string
    device: string
    description: string
  }

  private _isLost = false
  get isLost(): boolean { return this._isLost }

  private onRecoverCallbacks: Array<() => Promise<void>> = []

  private constructor(
    adapter: GPUAdapter,
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    canvasContext: GPUCanvasContext,
    format: GPUTextureFormat,
    adapterInfo: GPUContext['adapterInfo'],
  ) {
    this.adapter = adapter
    this.device = device
    this.canvas = canvas
    this.canvasContext = canvasContext
    this.format = format
    this.adapterInfo = adapterInfo

    this.registerDeviceLostHandler()
    this.registerErrorHandlers()
  }

  // ── Static factory ────────────────────────────────────────────────────────

  static async init(
    canvas: HTMLCanvasElement,
    options: GPUContextOptions = {},
  ): Promise<GPUContext> {
    if (!navigator.gpu) {
      throw new Error(
        'WebGPU is not supported. Use Chrome 113+ or Edge 113+ with GPU acceleration enabled.',
      )
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: options.powerPreference ?? 'high-performance',
    })
    if (!adapter) {
      throw new Error(
        'No suitable WebGPU adapter found. ' +
        'Ensure GPU acceleration is enabled in browser flags.',
      )
    }

    // Collect adapter info for debugging (especially useful on M1)
    // requestAdapterInfo() is draft spec — fall back to adapter.info if available
    const rawInfo = (adapter as unknown as { info?: GPUAdapterInfo }).info
    const adapterInfo = {
      vendor:       rawInfo?.vendor       ?? 'unknown',
      architecture: rawInfo?.architecture ?? 'unknown',
      device:       rawInfo?.device       ?? 'unknown',
      description:  rawInfo?.description  ?? '',
    }
    GPUContext.logAdapterInfo(adapterInfo, adapter)

    // Validate requested features are actually available
    const unsupported = (options.requiredFeatures ?? []).filter(
      (f) => !adapter.features.has(f),
    )
    if (unsupported.length > 0) {
      console.warn('[GPUContext] Unsupported features requested:', unsupported)
    }
    const features = (options.requiredFeatures ?? []).filter(
      (f) => adapter.features.has(f),
    ) as GPUFeatureName[]

    const device = await adapter.requestDevice({
      label: 'scale-of-world-tree',
      requiredFeatures: features,
      requiredLimits: options.requiredLimits ?? {},
    })

    const canvasCtx = canvas.getContext('webgpu')
    if (!canvasCtx) throw new Error('Failed to acquire WebGPU canvas context.')

    const format = navigator.gpu.getPreferredCanvasFormat()
    canvasCtx.configure({
      device,
      format,
      alphaMode: 'premultiplied',
      // colorSpace: 'srgb' is the default — explicit for clarity
    })

    return new GPUContext(adapter, device, canvas, canvasCtx, format, adapterInfo)
  }

  // ── Device-lost recovery ─────────────────────────────────────────────────

  /**
   * Register a callback that will be called whenever the device is recovered.
   * The game/renderer should re-upload all GPU resources inside this callback.
   */
  onRecover(callback: () => Promise<void>): void {
    this.onRecoverCallbacks.push(callback)
  }

  private registerDeviceLostHandler(): void {
    // device.lost is a Promise that resolves when the device is lost
    void this.device.lost.then(async (info) => {
      this._isLost = true
      console.warn(`[GPUContext] Device lost (reason: ${info.reason}): ${info.message}`)

      if (info.reason === 'destroyed') {
        // Intentional destroy — do not recover
        return
      }

      console.info('[GPUContext] Attempting device recovery...')
      try {
        const fresh = await GPUContext.init(this.canvas)
        // Re-register all callbacks on the new context
        for (const cb of this.onRecoverCallbacks) {
          fresh.onRecover(cb)
        }
        // Fire all recovery callbacks
        for (const cb of this.onRecoverCallbacks) {
          await cb()
        }
        this._isLost = false
        console.info('[GPUContext] Device recovered successfully.')
      } catch (err) {
        console.error('[GPUContext] Recovery failed:', err)
      }
    })
  }

  private registerErrorHandlers(): void {
    // Catches WebGPU validation and OOM errors not handled at call site
    this.device.addEventListener('uncapturederror', (event) => {
      const e = (event as GPUUncapturedErrorEvent).error
      if (e instanceof GPUValidationError) {
        console.error('[GPUContext] Validation error:', e.message)
      } else if (e instanceof GPUOutOfMemoryError) {
        console.error('[GPUContext] Out-of-memory error:', e.message)
      } else {
        console.error('[GPUContext] Unknown GPU error:', e)
      }
    })
  }

  // ── Canvas resize ────────────────────────────────────────────────────────

  /**
   * Call this when the canvas size changes (e.g., window resize).
   * Reconfigures the swap chain at the new dimensions.
   */
  resize(width: number, height: number): void {
    this.canvas.width  = width
    this.canvas.height = height
    this.canvasContext.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    })
  }

  // ── Convenience: create a command encoder labeled by pass name ───────────

  createEncoder(label?: string): GPUCommandEncoder {
    return this.device.createCommandEncoder({ label })
  }

  // ── Logging ──────────────────────────────────────────────────────────────

  private static logAdapterInfo(
    info: GPUContext['adapterInfo'],
    adapter: GPUAdapter,
  ): void {
    const limits = adapter.limits
    console.groupCollapsed('[GPUContext] Adapter info')
    console.log('Vendor      :', info.vendor)
    console.log('Architecture:', info.architecture)
    console.log('Device      :', info.device)
    console.log('Max texture size :', limits.maxTextureDimension2D)
    console.log('Max uniform buf  :', limits.maxUniformBufferBindingSize, 'bytes')
    console.log('Max storage buf  :', limits.maxStorageBufferBindingSize, 'bytes')
    console.log('Max instances    :', limits.maxVertexBuffers)
    console.log('Supported features:', [...adapter.features].join(', ') || 'none')
    console.groupEnd()
  }
}
