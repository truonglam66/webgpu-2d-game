# CLAUDE.md — Scale of the World-Tree (Dragon Scale)

Tài liệu quy tắc dự án cho Claude. Đọc file này trước mọi tác vụ liên quan đến dự án.

---

## 1. Tổng quan dự án

| Thông tin | Chi tiết |
|---|---|
| **Tên game** | Scale of the World-Tree (Dragon Scale) |
| **Thể loại** | 2D Action Platformer / Open-world Flight |
| **Nền tảng** | Web — chạy trực tiếp trên trình duyệt |
| **Stack** | WebGPU · TypeScript · Vite |
| **Phần cứng mục tiêu** | MacBook M1 (Unified Memory), Chrome 113+ |
| **Developer** | Lâm Trường (Nomad Lam) — indie developer |

---

## 2. Cốt truyện & Game Loop

Người chơi vào vai **kiếm sĩ sống trên Cây Thế Giới (World Tree)** khổng lồ.

### Hai giai đoạn chơi

```
Lv 1–19  │ Di chuyển bằng chân  │ Hack & Slash trên cành cây, hang hốc
Lv 20+   │ Cưỡi Rồng bay tự do  │ Aerial combat, kỹ năng nguyên tố đặc biệt
```

Cột mốc Lv 20: hoàn thành 1 trong 6 **Nhiệm vụ Nguyên tố** → mở khóa Rồng tương ứng.

---

## 3. Hệ thống Nguyên tố — 6 loài Rồng

| Nguyên tố | Gameplay | WebGPU Effect | Độ ưu tiên triển khai |
|---|---|---|---|
| **Lửa (Fire)** | AOE damage mạnh | Particle system cháy, dynamic lighting | Cao |
| **Gió (Wind)** | Tốc độ & linh hoạt | Distortion shader (air warp) | Cao |
| **Băng (Ice)** | Crowd control | Surface freeze, snow particles | Trung |
| **Cây (Nature)** | Hồi phục & trói chân | Procedural vine generation | Trung |
| **Đất (Earth)** | Tank / phòng thủ | Normal mapping (stone dragon scales) | Thấp |
| **Bóng tối (Dark)** | Tàng hình & life steal | Stencil buffer shadow, blur effect | Thấp |

---

## 4. Roadmap 3 tháng

### Tháng 1 — Nền tảng & Di chuyển
- [x] WebGPU Boilerplate (Device, Adapter, Pipeline, Renderer)
- [ ] Tilemap system (World Tree environment)
- [ ] Physics: trọng lực, chạy, nhảy, va chạm platformer
- [ ] Hack & Slash combat cơ bản (attack, combo, hitbox)
- [ ] Animation system (Sprite Sheet + frame controller)
- [ ] Camera follow player

### Tháng 2 — Cơ chế Rồng & Nhiệm vụ
- [ ] 6 Mini-dungeons (1 per element)
- [ ] Mounting System (player ↔ dragon transition)
- [ ] Free-flight physics (lực nâng, drag, dive)
- [ ] Compute Shader cho elemental skills
- [ ] Basic enemy AI (ground + flying)

### Tháng 3 — Đánh bóng & Nội dung
- [ ] Enemy AI nâng cao (state machine: patrol → chase → attack)
- [ ] Post-processing: Bloom, Screen Shake, Motion Blur
- [ ] Sound system (Web Audio API)
- [ ] Performance pass: target 60 FPS stable trên M1
- [ ] Level design pass (World Tree map đầy đủ)

---

## 5. Kiến trúc kỹ thuật

### Cấu trúc thư mục (mục tiêu)

```
src/
├── core/
│   ├── Renderer.ts        # WebGPU pipeline, instanced sprite batching
│   ├── Game.ts            # Game loop, scene management
│   ├── Input.ts           # Keyboard / gamepad
│   ├── Math2D.ts          # Vec2, Rect, matrix utils
│   └── Camera.ts          # Viewport, follow, zoom
├── physics/
│   ├── World.ts           # Gravity, collision broadphase
│   └── RigidBody.ts       # Per-entity physics state
├── rendering/
│   ├── TileRenderer.ts    # Chunked tilemap (instanced)
│   ├── ParticleSystem.ts  # GPU-side particle (Compute Shader)
│   └── PostProcess.ts     # Bloom, blur, distortion passes
├── entities/
│   ├── Player.ts          # Lv 1-19 ground warrior
│   ├── Dragon.ts          # Lv 20+ mount + elemental skills
│   ├── Enemy.ts           # Base enemy class
│   └── enemies/           # Specific enemy types
├── world/
│   ├── Tilemap.ts         # Chunk-based map loader
│   ├── Dungeon.ts         # Mini-dungeon generator
│   └── WorldTree.ts       # Background / parallax layers
├── systems/
│   ├── Combat.ts          # Hitbox, damage, knockback
│   ├── ElementSystem.ts   # 6 elements + dragon unlocks
│   └── ProgressSystem.ts  # Level, XP, quests
├── shaders/
│   ├── sprite.wgsl        # Instanced sprite renderer
│   ├── tilemap.wgsl       # Tilemap renderer
│   ├── particle.wgsl      # GPU particle compute
│   ├── fire.wgsl          # Fire elemental effect
│   ├── wind.wgsl          # Distortion effect
│   ├── ice.wgsl           # Freeze surface effect
│   ├── dark.wgsl          # Stencil shadow effect
│   └── postprocess.wgsl   # Bloom / motion blur
└── ui/
    ├── HUD.ts             # Health bar, MP, level
    └── Menu.ts            # Title / pause / element select
```

### Nguyên tắc rendering
- **Instanced Rendering**: mọi sprite (lá cây, quái vật, particles) đều dùng instanced draw call
- **Texture Atlas**: toàn bộ sprite pack vào 1 atlas → giảm bind group switch
- **Compute Shader**: particle system và elemental effects chạy hoàn toàn trên GPU
- **Render Pass order**: Background → Tilemap → Entities → Particles → Post-process → HUD

---

## 6. Quy tắc kỹ thuật cứng (Hard Rules)

### WebGPU / WGSL
- Luôn dùng **WGSL** (không dùng GLSL). Lý do: tương thích Metal API trên macOS/M1.
- Mọi buffer cần align đúng `wgpu` alignment rules (vec2 → 8 bytes, vec4 → 16 bytes, mat4 → 64 bytes).
- Dùng `GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX` cho dynamic instance buffer.
- Không dùng `mapped_at_creation` cho buffer lớn — dùng `writeBuffer` qua queue.
- Device lost handler phải luôn được đăng ký.

### TypeScript
- `strict: true` — không bypass bằng `any` hoặc `!` non-null assertion bừa bãi.
- Mỗi module export rõ interface; tránh coupling chặt giữa các system.
- Không dùng `enum` — dùng `const` object hoặc union type.

### Performance (M1 target)
- **Mục tiêu**: 60 FPS stable với 10,000+ instances trên canvas 1440p.
- Tận dụng **Unified Memory**: tránh unnecessary CPU↔GPU copy; prefer `writeBuffer` one-shot.
- Profile thường xuyên với **Spector.js** trên Chrome.
- Chunk-based World Tree map: chỉ load/render chunk trong viewport + 1 chunk margin.

### Tổ chức code
- Không thêm tính năng ngoài scope roadmap tháng hiện tại.
- Mỗi system là class độc lập, không gọi trực tiếp sang system khác — dùng event bus hoặc Game làm mediator.
- Shader file đặt trong `src/shaders/`, import bằng `?raw` (Vite).

---

## 7. Công cụ & Tài nguyên

| Loại | Công cụ |
|---|---|
| **IDE** | VS Code + Extension: WGSL Literal |
| **GPU Debug** | Spector.js (Chrome extension) |
| **Sprite / Atlas** | TexturePacker (atlas packing), Aseprite (pixel art) |
| **Assets** | Itch.io, CraftPix, OpenGameArt |
| **Build** | Vite 5, TypeScript 5 |
| **Browser** | Chrome 113+ (WebGPU required) |

---

## 8. Trạng thái hiện tại (Current State)

**Đã hoàn thành (Tháng 1 - Sprint 1):**
- WebGPU boilerplate: Device, Adapter, Pipeline khởi tạo thành công
- Instanced Sprite Renderer với texture atlas support
- WGSL shader: per-instance position, size, UV, RGBA tint, rotation
- Orthographic camera (pixel-space projection)
- Keyboard input handler
- Demo game loop: Player + Enemy + Bullet + Particle system

**Chưa làm:**
- Physics / platformer collision
- Tilemap system
- Animation frame controller
- Actual game art / sprite sheets
- Tất cả nội dung Tháng 1 còn lại

---

## 9. Conventions

- Đơn vị tọa độ: **pixel** (1 unit = 1 pixel, origin top-left)
- Frame rate target: **60 FPS** (delta time capped tại 50ms để tránh spiral of death)
- Language: Code comment bằng **tiếng Anh**; trao đổi với developer bằng **tiếng Việt**
- Commit message: tiếng Anh, imperative mood (`Add tilemap chunking`, không phải `Added`)