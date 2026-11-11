import raw from '../../public/art/ships_v10/manifest.json';
import type { Motion } from './rigmath';

export interface SocketDef {
  id: string;
  type: string;
  u: number;
  v: number;
  radius: number;
  turret_draw_size: number;
  side: string;
  rest_angle_deg: number;
  arc_deg: [number, number];
  parent: string;
  tone_gain: number;
  draw_index: number;
}

export interface NozzleDef {
  u: number;
  v: number;
  radius: number;
  side: string;
}

export interface SpritePart {
  name: string;
  kind: 'sprite';
  file: string;
  file_192?: string;
  size_px: [number, number];
  pivot_px: [number, number];
  anchor_uv: [number, number];
  layer: 'under' | 'over';
  rest_angle_deg: number;
  motion?: Motion;
  carries_sockets?: string[];
}

export interface ChainSeg {
  file: string;
  size_px: [number, number];
  pivot_px: [number, number];
  length: number;
  motion: Motion;
}

export interface ChainPart {
  name: string;
  kind: 'chain';
  layer: 'under' | 'over';
  anchor_uv: [number, number];
  rest_angle_deg: number;
  segments: ChainSeg[];
}

export type RigPart = SpritePart | ChainPart;

export interface HaloDef {
  color: [number, number, number];
  alpha: number;
  blur_k: number;
  dilate_k?: number;
  kind: 'soft' | 'outline';
}

export interface ShipDef {
  id: string;
  race: string;
  base_512: string;
  base_192: string;
  glow_512: string;
  glow_192: string;
  turret_halo?: HaloDef | null;
  sockets: SocketDef[];
  nozzles: NozzleDef[];
  rig: {
    loop_s?: number;
    parts: RigPart[];
    glow: { color: [number, number, number]; alpha: string };
    core?: { u: number; v: number; radius: number; blur: number; color: [number, number, number]; alpha: string };
    glints?: { u: number; v: number; size: number }[];
  };
}

interface Manifest {
  loop_s: number;
  hull_mapping: Record<string, Record<string, string | null>>;
  turret_sets: Record<string, Record<string, { file_128: string; file_64: string }>>;
  ships: ShipDef[];
}

const manifest = raw as unknown as Manifest;

for (const ship of manifest.ships) {
  ship.sockets.sort((a, b) => a.draw_index - b.draw_index);
}

export const LOOP_S = manifest.loop_s || 2.4;

export const SHIP_BY_ID: Record<string, ShipDef> = Object.fromEntries(manifest.ships.map((s) => [s.id, s]));

const RACE_SLUG: Record<string, string> = {
  human: 'human',
  zhargi: 'zhargi',
  kvissae: 'kvissae',
  taeyori: 'teyori',
  virex: 'vireks',
  omnir: 'omnir',
  free: 'human',
  pirate: 'human',
};

export function artRace(faction: string): string {
  return RACE_SLUG[faction] ?? 'human';
}

export function v10ShipId(faction: string, hullId: string): string {
  if (hullId === 'zhargi_cruiser' || hullId === 'omnir_carrier') return hullId;
  const race = artRace(faction);
  const table = manifest.hull_mapping[race] ?? manifest.hull_mapping.human!;
  if (race === 'omnir' && hullId === 'korob') return 'omnir_carrier';
  const id = table[hullId];
  if (id) return id;
  return table.iskra ?? `${race}_fighter`;
}

export function shipDef(faction: string, hullId: string): ShipDef | undefined {
  return SHIP_BY_ID[v10ShipId(faction, hullId)];
}

export function turretFile(race: string, type: string, low: boolean): string | null {
  const set = manifest.turret_sets[race]?.[type];
  if (!set) return null;
  return low ? set.file_64 : set.file_128;
}

export function turretKnown(race: string, type: string): boolean {
  return !!manifest.turret_sets[race]?.[type];
}

export function assetPaths(low: boolean): string[] {
  const out: string[] = [];
  for (const ship of manifest.ships) {
    out.push(low ? ship.base_192 : ship.base_512, low ? ship.glow_192 : ship.glow_512);
    for (const part of ship.rig.parts) {
      if (part.kind === 'sprite') out.push(low && part.file_192 ? part.file_192 : part.file);
      else for (const seg of part.segments) out.push(seg.file);
    }
  }
  for (const race of Object.keys(manifest.turret_sets)) {
    for (const type of Object.keys(manifest.turret_sets[race]!)) {
      const file = turretFile(race, type, low);
      if (file) out.push(file);
    }
  }
  return out;
}
