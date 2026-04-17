export class Input {
  private keys = new Set<string>()
  private justPressed = new Set<string>()
  private justReleased = new Set<string>()

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code)
      this.keys.add(e.code)
      e.preventDefault()
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
      this.justReleased.add(e.code)
    })
  }

  isDown(code: string): boolean {
    return this.keys.has(code)
  }

  wasJustPressed(code: string): boolean {
    return this.justPressed.has(code)
  }

  /** Call once per frame after processing input */
  flush(): void {
    this.justPressed.clear()
    this.justReleased.clear()
  }
}
