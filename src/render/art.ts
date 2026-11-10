import { getQuality } from './quality';

const cache = new Map<string, HTMLImageElement>();
const masks = new Map<string, HTMLCanvasElement>();

export function artUrl(path: string): string {
  return `${import.meta.env.BASE_URL}art/${path}`;
}

export function loadImage(path: string): HTMLImageElement {
  const url = artUrl(path);
  const hit = cache.get(url);
  if (hit) return hit;
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  cache.set(url, img);
  return img;
}

export function ready(img: HTMLImageElement | undefined): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0;
}

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

const HULL_SLUG: Record<string, string> = {
  iskra: 'fighter',
  klinok: 'frigate',
  korob: 'trader',
};

export function shipFile(faction: string, hullId: string): string {
  const race = RACE_SLUG[faction] ?? 'human';
  if (hullId === 'monolit') {
    const capital: Record<string, string> = {
      human: 'human_carrier',
      zhargi: 'zhargi_gate',
      kvissae: 'kvissae_fan',
      teyori: 'teyori_ark',
      vireks: 'vireks_mother',
      omnir: 'omnir_hivemaw',
    };
    return capital[race] ?? `${race}_cruiser`;
  }
  if (hullId === 'oplot') {
    if (race === 'zhargi') return 'zhargi_battleship';
    if (race === 'omnir') return 'omnir_battleship';
    return `${race}_cruiser`;
  }
  return `${race}_${HULL_SLUG[hullId] ?? 'fighter'}`;
}

export function shipImage(faction: string, hullId: string): HTMLImageElement {
  const file = shipFile(faction, hullId);
  const low = getQuality().name === 'low';
  return loadImage(low ? `ships/low/${file}.webp` : `ships/${file}.webp`);
}

const FACES: Record<string, string[]> = {
  human: ['portrait_human_m1', 'portrait_human_f1', 'portrait_human_f2'],
  zhargi: ['portrait_zhargi_1', 'portrait_zhargi_2', 'portrait_zhargi_3'],
  kvissae: ['portrait_kvissae_1', 'portrait_kvissae_2', 'portrait_kvissae_3'],
  taeyori: ['portrait_teyori_1', 'portrait_teyori_2', 'portrait_teyori_3'],
  virex: ['portrait_vireks_1', 'portrait_vireks_2', 'portrait_vireks_3'],
  omnir: ['portrait_omnir_1', 'portrait_omnir_2'],
};

export function portraitImage(race: string, portrait: number): HTMLImageElement {
  const list = FACES[race] ?? FACES.human!;
  const name = list[Math.abs(portrait | 0) % list.length]!;
  return loadImage(`portraits/${name}.webp`);
}

const PLANET: Record<string, string> = {
  volcanic: 'planet_lava',
  ocean: 'planet_ocean',
  barren: 'planet_desert',
  ice: 'planet_ice',
  gas: 'planet_gas',
  garden: 'planet_garden',
  hive: 'planet_toxic',
};

export function planetImage(type: string): HTMLImageElement {
  const name = PLANET[type] ?? 'planet_desert';
  const low = getQuality().name === 'low';
  return loadImage(low ? `planets/low_${name}.webp` : `planets/${name}.webp`);
}

export function ringImage(): HTMLImageElement {
  const low = getQuality().name === 'low';
  return loadImage(low ? 'planets/low_planet_ringed.webp' : 'planets/planet_ringed.webp');
}

export function systemImage(star: string): HTMLImageElement {
  const name = star === 'red' ? 'crimson' : star === 'blue' ? 'teal' : star === 'white' ? 'violet' : 'amber';
  return loadImage(`backgrounds/bg_system_${name}.webp`);
}

export function stationImage(owner: string): HTMLImageElement {
  const slug = RACE_SLUG[owner] ?? 'human';
  const known = ['human', 'zhargi', 'kvissae', 'teyori', 'vireks', 'omnir'];
  return loadImage(`backgrounds/bg_station_${known.includes(slug) ? slug : 'human'}.webp`);
}

export function menuNebula(): HTMLImageElement {
  return loadImage('backgrounds/bg_menu_nebula.webp');
}

export function menuPlanet(): HTMLImageElement {
  return loadImage('backgrounds/bg_menu_planet.webp');
}

export function splashImage(): HTMLImageElement {
  return loadImage('backgrounds/bg_intro_splash.webp');
}

const GOOD_ICON: Record<string, string> = {
  ore: 'minerals',
  alloy: 'alloys',
  fuel: 'fuel',
  food: 'food',
  meds: 'medicine',
  plates: 'tech_parts',
  cells: 'weapons_crate',
  pearl: 'luxury',
  water: 'crystals',
  data: 'artifacts',
  drones: 'repair_drone',
  iso: 'crystals',
};

const MOD_ICON: Record<string, string> = {
  igla: 'autocannon',
  igla2: 'autocannon',
  luch: 'laser',
  korona: 'laser',
  zhar: 'laser',
  zhar2: 'crystal_emitter',
  oskol: 'missile',
  rels: 'railgun',
  plazma: 'crystal_emitter',
  veil: 'shield',
  veil2: 'shield',
  rosa: 'shield',
  poryv: 'afterburner',
  shturm: 'afterburner',
  tros: 'sensor',
  klinch: 'ecm',
  metka: 'scanner',
  plate: 'armor',
  plate2: 'armor',
  shov: 'repair_drone',
  klin: 'weapons_crate',
  klin2: 'weapons_crate',
  zhila: 'tech_parts',
  um: 'sensor',
  zapas: 'cargo',
  srez: 'armor',
  'rig-range': 'railgun',
  'rig-pol': 'shield',
  'rig-hold': 'cargo',
  'rig-tug': 'afterburner',
  'rig-cap': 'tech_parts',
  'rig-hard': 'armor',
};

export function iconImage(kind: 'good' | 'mod', id: string): HTMLImageElement {
  const name = kind === 'good' ? GOOD_ICON[id] ?? 'cargo' : MOD_ICON[id] ?? 'tech_parts';
  const size = getQuality().name === 'low' ? 128 : 256;
  return loadImage(`icons/${size}/icon_${name}.webp`);
}

export function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, ox = 0, oy = 0): void {
  if (!ready(img)) return;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh);
}

type MaskKind = 'vein' | 'crystal' | 'amethyst';

export function emissiveMask(img: HTMLImageElement, kind: MaskKind): HTMLCanvasElement | null {
  if (!ready(img) || getQuality().name === 'low') return null;
  const key = `${img.src}|${kind}`;
  const hit = masks.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] ?? 0;
    const gv = px[i + 1] ?? 0;
    const b = px[i + 2] ?? 0;
    const a = px[i + 3] ?? 0;
    let keep = false;
    if (kind === 'vein') keep = a > 24 && r > 110 && r > gv * 1.35 && r > b * 1.15;
    else if (kind === 'crystal') keep = a > 24 && b > 90 && b > gv && r + b > 180;
    else keep = a > 24 && b > 80 && r > 50 && b > gv * 1.15 && r < 210;
    if (!keep) {
      px[i] = 0;
      px[i + 1] = 0;
      px[i + 2] = 0;
      px[i + 3] = 0;
    }
  }
  g.putImageData(data, 0, 0);
  masks.set(key, c);
  return c;
}

export function preloadArt(): void {
  menuNebula();
  menuPlanet();
  splashImage();
  for (const race of ['human', 'zhargi', 'kvissae', 'taeyori', 'virex', 'omnir']) {
    for (const hull of ['iskra', 'klinok', 'korob', 'oplot', 'monolit']) shipImage(race, hull);
    portraitImage(race, 0);
    portraitImage(race, 1);
  }
  for (const type of Object.keys(PLANET)) planetImage(type);
  for (const star of ['yellow', 'red', 'blue', 'white']) systemImage(star);
}
