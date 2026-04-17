export const TileType = {
  EMPTY: 0,
  SOLID: 1,
} as const
export type TileType = (typeof TileType)[keyof typeof TileType]

export class Tilemap {
  readonly width: number
  readonly height: number
  readonly tileSize: number
  private readonly tiles: Uint8Array

  constructor(width: number, height: number, tileSize: number, tiles: Uint8Array) {
    this.width = width
    this.height = height
    this.tileSize = tileSize
    this.tiles = tiles
  }

  getTile(tx: number, ty: number): number {
    // Treat out-of-bounds as solid (world boundary)
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return TileType.SOLID
    return this.tiles[ty * this.width + tx]
  }

  isSolid(tx: number, ty: number): boolean {
    return this.getTile(tx, ty) === TileType.SOLID
  }

  get worldWidth(): number  { return this.width  * this.tileSize }
  get worldHeight(): number { return this.height * this.tileSize }

  // ── Level factory ─────────────────────────────────────────────────────────

  /**
   * Create the World Tree demo level.
   * 60 × 30 tiles, tile size 32px → world = 1920 × 960 px
   *
   * Layout (Y increases downward):
   *   Rows 27-29  Ground (with a pit at x 19-22)
   *   Rows 22-23  Level 1 platforms
   *   Rows 16-17  Level 2 platforms
   *   Rows 10-11  Level 3 platforms
   *   Rows  4-5   Level 4 platforms (near top / trunk)
   */
  static createWorldTree(): Tilemap {
    const W = 60, H = 30, TS = 32
    const tiles = new Uint8Array(W * H)

    const solid = (x: number, y: number) => {
      if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x] = TileType.SOLID
    }

    const row = (y: number, x1: number, x2: number) => {
      for (let x = x1; x <= x2; x++) solid(x, y)
    }

    const platform = (startX: number, y: number, len: number) => {
      for (let i = 0; i < len; i++) solid(startX + i, y)
    }

    // ── Ground (3 rows thick), pit at tiles 19-22 ──
    for (let r = 27; r < H; r++) {
      row(r, 0, 18)
      row(r, 23, W - 1)
    }

    // ── Level 1 branches (~y 22) ──
    platform(2,  22, 9)   // left branch
    platform(16, 23, 8)   // center-left
    platform(30, 22, 9)   // center-right
    platform(44, 23, 8)   // right branch

    // ── Level 2 branches (~y 16-17) ──
    platform(7,  17, 10)
    platform(23, 16,  9)
    platform(39, 17,  9)
    platform(52, 16,  7)

    // ── Level 3 branches (~y 10-11) ──
    platform(1,  11,  9)
    platform(15, 10, 11)
    platform(31, 11,  9)
    platform(46, 10, 10)

    // ── Level 4 upper branches (~y 4-5) ──
    platform(4,  5, 10)
    platform(20, 4, 12)
    platform(38, 5, 10)
    platform(53, 4,  6)

    return new Tilemap(W, H, TS, tiles)
  }
}
