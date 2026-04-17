import type { Renderer } from '../core/Renderer'
import type { Tilemap } from '../world/Tilemap'
import type { Camera } from '../core/Camera'
import { TileType } from '../world/Tilemap'

// Ground (thick soil/rock) — cỏ xanh → đất nâu → đá xám
const GROUND_GRASS: [number, number, number, number] = [0.22, 0.76, 0.18, 1.0]
const GROUND_SOIL:  [number, number, number, number] = [0.52, 0.35, 0.18, 1.0]
const GROUND_ROCK:  [number, number, number, number] = [0.34, 0.30, 0.26, 1.0]

// Branch platforms (thin wood) — vỏ cây sáng → gỗ tối
const BRANCH_BARK:  [number, number, number, number] = [0.62, 0.44, 0.20, 1.0]
const BRANCH_WOOD:  [number, number, number, number] = [0.40, 0.26, 0.10, 1.0]

export class TileRenderer {
  /**
   * Draw all visible solid tiles.
   * Only renders the chunk of tiles inside the camera viewport (+ 1-tile margin).
   *
   * Two visual categories:
   *   Thick ground  — tile has 2+ solid tiles below (grass/soil/rock palette)
   *   Branch/platform — thin structure, 0–1 solid tile below (bark/wood palette)
   */
  render(tilemap: Tilemap, camera: Camera, renderer: Renderer): void {
    const ts = tilemap.tileSize

    // Visible tile range
    const x0 = Math.max(0, Math.floor(camera.x / ts) - 1)
    const x1 = Math.min(tilemap.width  - 1, Math.ceil((camera.x + camera.width)  / ts) + 1)
    const y0 = Math.max(0, Math.floor(camera.y / ts) - 1)
    const y1 = Math.min(tilemap.height - 1, Math.ceil((camera.y + camera.height) / ts) + 1)

    renderer.useDefaultTexture()

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tilemap.getTile(tx, ty) !== TileType.SOLID) continue

        const topExposed  = !tilemap.isSolid(tx, ty - 1)
        const belowOne    =  tilemap.isSolid(tx, ty + 1)
        const belowTwo    =  tilemap.isSolid(tx, ty + 2)
        const isThick     = belowOne && belowTwo // ground = 3+ tiles thick

        let color: [number, number, number, number]
        if (isThick) {
          // Thick ground: grass surface → soil → rock
          if (topExposed) {
            color = GROUND_GRASS
          } else if (!tilemap.isSolid(tx, ty - 2)) {
            color = GROUND_SOIL
          } else {
            color = GROUND_ROCK
          }
        } else {
          // Branch / thin platform: bark on top, wood below
          color = topExposed ? BRANCH_BARK : BRANCH_WOOD
        }

        const { x: sx, y: sy } = camera.worldToScreen(
          tx * ts + ts / 2,
          ty * ts + ts / 2,
        )

        renderer.drawSprite({
          x: sx, y: sy,
          w: ts, h: ts,
          uvOffsetX: 0, uvOffsetY: 0, uvSizeX: 1, uvSizeY: 1,
          r: color[0], g: color[1], b: color[2], a: color[3],
          rotation: 0,
        })
      }
    }
  }
}
