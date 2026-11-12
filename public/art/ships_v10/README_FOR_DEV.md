# Кромка: ship art release v10 (approved final set)

Everything here is the **approved** art: Humans (fighter/frigate/trader v10, cruiser/carrier v11, no-orange recolor),
Zhargi v10 (6), Kvissae v10 (5), Teyori v10 (5), Vireks (fighter/trader/cruiser v10, frigate/flagship v11) and Omnir v11 (5, biomech).
Total: 31 ships, 38 turret types, 6 per-race rigs.

Start with `manifest.json`. It is the single source of truth. `reference_renderer.py` (Python + Pillow) is an
**executable spec** of the drawing rules below: `python3 reference_renderer.py vireks_cruiser 0.25 out.png`.
If the in-game picture differs from the reference renderer, the game is wrong.

## Folder layout
```
manifest.json                    all ships, sockets, nozzles, rigs, turret sets, id mapping
<race>_anim_rig.json             the same rig blocks per race (convenience copy of manifest.ships[].rig)
ships/<id>/<id>_512.webp         base hull, 512x512, transparent, NO turrets, NO animated parts
ships/<id>/<id>_192.webp         low-quality copy, 192x192
ships/<id>/<id>_glow_512.webp    emissive mask (RGB white, alpha = strength), same framing as the base
ships/<id>/<id>_glow_192.webp
ships/<id>/parts/*.webp          animated part sprites at the SAME pixel scale as the 512 base
ships/<id>/parts_192/*.webp      the same parts at the 192 scale (pivot_px * 0.375)
turrets/<race>/<race>_turret_<type>_128.webp / _64.webp
reference_renderer.py
```

## Coordinate system
* Every ship sprite is a square. The source canvas was 1024 px; the 512 and 192 sprites are uniform downscales of it.
* `u,v` are normalized ship coordinates in [0,1] over that square: origin top-left, `u` right, `v` down.
  **The nose points up (-v), the stern down (+v).** In world space rotate the whole ship by its heading (heading 0 = nose up).
* Lengths (`radius`, `turret_draw_size`, `dx`, `dy`, segment `length`) are normalized by the same square side.
  At draw size D px: `px = u * D`, `radius_px = radius * D`.
* `bbox_uv` is the tight hull box (`u0,v0,u1,v1`). Use it to pick an on-screen size for each hull class. The old v3 sprites were
  also 512 squares, so `hullScale()` in `src/render/art.ts` still roughly fits; re-tune per class if needed.
* `mirror_axis_u` is the ship's symmetry axis (≈0.5).

## Angles
Degrees, **positive = clockwise on screen**, the same as canvas `ctx.rotate(rad)`. Turret angle 0 means the barrels point up
(towards the nose). Part angles are offsets from the part's rest pose as painted.

## Turrets
* Turret sprites are top-down with barrels **UP**, pivot = sprite centre (0.5, 0.5), transparent. Provided at 128 and 64 px.
* `turret_sets[race][type].ring_radius_frac` = ring radius / sprite side. The socket's `turret_draw_size` already applies it:
  draw the sprite as a `turret_draw_size * D` square centred on the socket.
* Per-race tone: it is already baked into the sprites (Humans: gamma 0.85 × 1.08, Vireks: ×1.12, Teyori: ×1.18).
  Per socket `tone_gain` (0.9–1.25) is an extra RGB multiply that matches the hull's brightness. Use a `multiply` tint or ignore it (it is subtle).
* `turret_halo` (per ship, from race) restores the readability halo used in the approved images:
  * `kind: soft` (Vireks blue, Teyori violet): blurred copy of the turret alpha in `color`, alpha × `alpha`, blur ≈ `blur_k` × k.
  * `kind: outline` (Omnir red): dilate the alpha by ≈ `dilate_k` × k first, then blur. Here `k = max(0.4, radius*1024/40) * D/1024`.
  * A soft drop shadow at offset ≈ (+2k, +3k) under each turret matches the art.
* Socket fields:
  `id, type` (default turret type), `u, v`, `radius` (socket ring radius), `turret_draw_size`,
  `side` (`left` / `right` / `center`), `rest_angle_deg` (pose used in the approved art: slightly outward-forward on side mounts),
  `arc_deg [min,max]` (allowed traverse relative to the nose, default: center ±150, right −30…+170, left −170…+30; gameplay may narrow it),
  `parent` (`hull` or the name of an animated part), `tone_gain`, `draw_index` (paint order; later = on top, for superfiring pairs).
* Sockets are mirror-symmetric pairs. Any weapon type can be fitted; `type` is only the default look.
* **Turrets on moving parts:** if `parent` is a part name, transform the socket by that part's current transform
  (rotate around the part anchor by the part angle, then add the part's bob offset) and add the part angle to the turret heading.
  The part's `carries_sockets` lists them too.

## Engine nozzles
`nozzles[]`: `u, v` = the nozzle exit (top of the painted plume), `radius`, `side`. Spawn engine trails there, pointing to +v (stern).
The approved art has a **short painted exhaust plume baked into the base hull** (plus its emissive glow in the glow mask).
Draw the code trail starting at the nozzle point, under the hull, so it reads as one plume. Scale its length and brightness with thrust.
Nozzles were auto-detected and checked by eye. The Kvissae fighter's single mid-body engine was set by hand.

## Glow masks
RGBA, RGB = white, alpha = emissive strength, same framing as the base. Draw with `globalCompositeOperation = "lighter"`,
tinted by `rig.glow.color`, with the alpha modulated by `rig.glow.alpha(t)` (formula string; `t` in [0,1) over the 2.4 s loop;
`flicker(t) = 0.5+0.5*sin(2π·7t+0.7)·sin(2π·3t+1.4)`). For static races (Humans, Zhargi) use it for blink/shimmer however you like.
Omnir also have `rig.core`: a pulsing radial glow (centre uv, radius, blur, colour, alpha(t)) on the core-eye.
Kvissae have `rig.glints`: lens positions for short 4-point star flashes, one flash per loop each, with phase offsets.

## Animated parts (rig)
`rig.loop_s = 2.4` s, `t = (time % loop_s) / loop_s`. Each `rig.parts[]` entry is one of:
* `kind: sprite`, with `file`, `file_192`, `size_px` (at the 512 scale), `pivot_px` / `pivot_norm` (pivot inside the sprite, may lie slightly outside
  its bounds), `anchor_uv` (where the pivot sits on the ship at rest), `layer` (`under` = before the hull, `over` = after the hull),
  `rest_angle_deg`, `motion`:
  * `sin`:  `angle = rest + amp_deg * sin(2π·cycles·t + phase)`
  * `open`: `angle = rest + amp_deg * (0.5 − 0.5·cos(2π·cycles·t + phase))` (jaws/claws/wing-cases: 0 = closed, max = open)
  * `bob`:  `angle = rest + amp_deg·sin(φ)`, `offset = (dx·cos(φ), dy·sin(φ))` with `φ = 2π·t + phase` (floating shards, pods, rings)
  The left/right sign is already baked into `amp_deg` / `dx`, so the motion is mirror-symmetric.
  Draw it rotated by `angle` around `pivot_px`, with the pivot placed at `anchor_uv·D + offset`.
* `kind: chain` (Omnir tendrils): `anchor_uv`, `rest_angle_deg`, `segments[]` (file, pivot_px, length, motion).
  `a0 = rest; a_i = a_{i−1} + amp_i·sin(2π·t + phase_i)`. Segment i is drawn rotated by `a_i` around its pivot placed at joint i;
  `joint_{i+1} = joint_i + rotate((0, length_i·D), a_i)`. 0° = hanging straight down (towards the stern).

### Rendering order (per ship, per frame)
1. engine trails (code) from `nozzles`
2. parts with `layer: under` (wings, tails, fans, Omnir jaws and tendrils)
3. base hull
4. hull-parented turrets, rotated towards their target within `arc_deg`, in `draw_index` order (shadow → halo → sprite)
5. parts with `layer: over` (claws, wing-cases, shells, floating shards/pods/rings), then the turrets parented to them
6. glow mask (additive, pulsing), Omnir core, Kvissae glints

The bases have the moving parts cut out. Under-body areas that a part can uncover were inpainted
(wing-cases, shells, claw roots), so small motion never shows holes. Do not draw a base without its parts.

### Per-race animation notes
* **Teyori**: levitating shards (auto-cut `floatNN_*`), side lances (fighter), crescent arms (frigate), floating rings (trader) and side pods (ark) bob and drift with phase offsets.
  Core/runes pulse and the field arcs flicker (glow alpha uses `flicker`). Turret rings do not spin separately (they are part of the turret sprite).
* **Vireks**: lattice wings flutter (±~2°, 8 cycles per loop), claws/mandibles/crown mandibles open-close slowly, the trader's wing-cases breathe (open 1.4°, they carry turrets), blue seams pulse twice per loop.
* **Kvissae**: slow wing beats (±2–3°, wings carry turrets on cruiser/flagship/trader), tail streamers and tail fans/skirts spread and fold (phase-shifted), frigate shells breathe; lenses glint.
* **Omnir**: jaws open-close, stern tendrils sway as 4-segment chains, veins pulse twice per loop, the core-eye throbs.
* **Humans, Zhargi**: no moving parts (by design); just turrets, glow and engine trails.

## Mapping to the current game (`src/render/art.ts`, `public/art/ships`)
`manifest.old_to_new` maps every old art id to its new ship id. `manifest.hull_mapping` maps race × hull
(`iskra` fighter, `klinok` frigate, `korob` trader, `oplot` cruiser, `monolit` capital) to a new id:

| new id | race | class | replaces old art id | sockets | nozzles | animated |
|---|---|---|---|---|---|---|
| `human_fighter` | Люди | Истребитель | `human_fighter` | 4 | 2 | — |
| `human_frigate` | Люди | Фрегат | `human_frigate` | 5 | 3 | — |
| `human_trader` | Люди | Торговец | `human_trader` | 3 | 5 | — |
| `human_cruiser` | Люди | Крейсер | `human_cruiser` | 6 | 4 | — |
| `human_carrier` | Люди | Авианосец | `human_carrier` | 9 | 6 | — |
| `zhargi_fighter` | Зхарги | Истребитель | `zhargi_fighter` | 2 | 2 | — |
| `zhargi_frigate` | Зхарги | Фрегат | `zhargi_frigate` | 3 | 2 | — |
| `zhargi_trader` | Зхарги | Торговец | `zhargi_trader` | 3 | 2 | — |
| `zhargi_cruiser` | Зхарги | Крейсер | — (new, unmapped) | 12 | 3 | — |
| `zhargi_battleship` | Зхарги | Линкор | `zhargi_battleship` | 15 | 4 | — |
| `zhargi_citadel` | Зхарги | Цитадель | `zhargi_gate` | 14 | 5 | — |
| `kvissae_fighter` | Квиссаэ | Истребитель | `kvissae_fighter` | 2 | 1 | yes |
| `kvissae_frigate` | Квиссаэ | Фрегат | `kvissae_frigate` | 3 | 2 | yes |
| `kvissae_trader` | Квиссаэ | Торговец | `kvissae_trader` | 8 | 4 | yes |
| `kvissae_cruiser` | Квиссаэ | Крейсер | `kvissae_cruiser` | 8 | 3 | yes |
| `kvissae_flagship` | Квиссаэ | Флагман | `kvissae_fan` | 9 | 5 | yes |
| `teyori_fighter` | Тэйори | Истребитель | `teyori_fighter` | 2 | 2 | yes |
| `teyori_frigate` | Тэйори | Фрегат | `teyori_frigate` | 6 | 3 | yes |
| `teyori_trader` | Тэйори | Торговец | `teyori_trader` | 8 | 4 | yes |
| `teyori_cruiser` | Тэйори | Крейсер | `teyori_cruiser` | 7 | 4 | yes |
| `teyori_ark` | Тэйори | Ковчег | `teyori_ark` | 9 | 4 | yes |
| `vireks_fighter` | Вирексы | Истребитель | `vireks_fighter` | 2 | 2 | yes |
| `vireks_trader` | Вирексы | Торговец | `vireks_trader` | 6 | 4 | yes |
| `vireks_cruiser` | Вирексы | Крейсер | `vireks_cruiser` | 4 | 1 | yes |
| `vireks_frigate` | Вирексы | Фрегат | `vireks_frigate` | 6 | 1 | yes |
| `vireks_flagship` | Вирексы | Флагман | `vireks_mother` | 12 | 5 | yes |
| `omnir_fighter` | Омнир | Истребитель | `omnir_fighter` | 2 | 2 | yes |
| `omnir_frigate` | Омнир | Фрегат | `omnir_frigate` | 3 | 1 | yes |
| `omnir_cruiser` | Омнир | Крейсер | `omnir_battleship` | 5 | 2 | yes |
| `omnir_carrier` | Омнир | Носитель | — (new, unmapped) | 6 | 4 | yes |
| `omnir_dreadnought` | Омнир | Дредноут | `omnir_hivemaw` | 12 | 4 | yes |
Class differences vs. the old set:
* capitals: Humans `carrier` (old command-carrier), Zhargi `citadel` (old `zhargi_gate`), Kvissae `flagship` (old `kvissae_fan`), Teyori `ark`, Vireks `flagship` hive carrier (old `vireks_mother`), Omnir `dreadnought` (old `omnir_hivemaw`).
* `oplot`: Zhargi keep `battleship` as in the current code. The new `zhargi_cruiser` has no old id (extra hull). Omnir `oplot` → `omnir_cruiser` (lance, old `omnir_battleship`).
* Omnir have **no trader** in the new set (`korob` → null: keep the old `omnir_trader` v3 sprite, or use `omnir_carrier`, which is new and unmapped).
* Omnir `frigate` is the crescent raider («Рейдер»).

Suggested integration: put this folder at `public/art/ships_v10/`, point `shipFile()` through `hull_mapping`, load
`base_512`/`base_192` by quality (same rule as today) and draw turrets, parts and glow per the order above.
The old v3 `ships/` sprites have turrets painted in, so do not mix them with the socket system.
