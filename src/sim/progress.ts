import type { FactionId, SkillId, SkillSet } from './types';
import type { CareerId, PlayableRace } from './types';

export const SKILL_IDS: SkillId[] = ['aim', 'helm', 'engineering', 'trade', 'charm', 'lead', 'survey'];

export const SKILL_MAX = 5;

export interface SkillDef {
  id: SkillId;
  name: string;
  blurb: string;
  perLevel: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'aim', name: 'Точность', blurb: 'Орудие ложится ближе к прицелу.', perLevel: '+6% к попаданию и +4% к оптимуму' },
  { id: 'helm', name: 'Манёвренность', blurb: 'Корпус слушается руля.', perLevel: '+5% скорости и +8% к разгону' },
  { id: 'engineering', name: 'Техника', blurb: 'Верфь и ремонтный док.', perLevel: '+5% сети и процессора, −6% к ремонту' },
  { id: 'trade', name: 'Торговля', blurb: 'Чутьё на цену.', perLevel: '−4% к закупу и +3% к продаже' },
  { id: 'charm', name: 'Обаяние', blurb: 'Доки и контракты.', perLevel: '+15% к приросту репутации и к награде контракта' },
  { id: 'lead', name: 'Лидерство', blurb: 'Чужие головы и свой залп рядом с союзниками.', perLevel: '+10% к боевой награде и урон за союзника рядом (у Людей до четырёх)' },
  { id: 'survey', name: 'Разведка', blurb: 'Новые системы и захват.', perLevel: '+8% к захвату и +10% опыта за первое посещение' },
];

export const SKILL_BY_ID: Record<SkillId, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

/** Cumulative XP at which the next unspent point appears. */
export const POINT_XP = [0, 80, 180, 320, 500, 720, 980, 1280, 1620, 2000, 2420, 2880, 3380, 3920, 4500];

export function pointsEarned(xp: number): number {
  let n = 0;
  for (let i = 1; i < POINT_XP.length; i++) if (xp >= POINT_XP[i]!) n = i;
  if (xp >= POINT_XP[POINT_XP.length - 1]!) {
    const extra = xp - POINT_XP[POINT_XP.length - 1]!;
    n += Math.floor(extra / 600);
  }
  return n;
}

export function xpToNextPoint(xp: number): { have: number; need: number } {
  const earned = pointsEarned(xp);
  const prev = earned <= 0 ? 0 : earned < POINT_XP.length ? POINT_XP[earned]! : POINT_XP[POINT_XP.length - 1]! + (earned - (POINT_XP.length - 1)) * 600;
  const next = earned + 1 < POINT_XP.length ? POINT_XP[earned + 1]! : POINT_XP[POINT_XP.length - 1]! + (earned + 1 - (POINT_XP.length - 1)) * 600;
  return { have: Math.max(0, xp - prev), need: Math.max(1, next - prev) };
}

export interface TrackDef {
  id: string;
  name: string;
  kind: 'hull' | 'weapon';
  blurb: string;
}

export const TRACKS: TrackDef[] = [
  { id: 'hull.scout', name: 'Лёгкие корпуса', kind: 'hull', blurb: '«Искра» и путь к ударным.' },
  { id: 'hull.strike', name: 'Ударные корпуса', kind: 'hull', blurb: '«Клинок». Открывает крейсер.' },
  { id: 'hull.hauler', name: 'Грузовые корпуса', kind: 'hull', blurb: '«Короб» и толстые трюмы.' },
  { id: 'hull.cruiser', name: 'Крейсера', kind: 'hull', blurb: '«Оплот». Дальше — линкор.' },
  { id: 'hull.capital', name: 'Тяжёлые корпуса', kind: 'hull', blurb: '«Монолит».' },
  { id: 'wep.kinetic', name: 'Автопушки', kind: 'weapon', blurb: 'Кинетика. Уровень 2 открывает второе поколение.' },
  { id: 'wep.energy', name: 'Лучи', kind: 'weapon', blurb: 'ЭМ и термал.' },
  { id: 'wep.missile', name: 'Ракеты', kind: 'weapon', blurb: 'Взрывной урон.' },
  { id: 'wep.rail', name: 'Рельсы', kind: 'weapon', blurb: 'Дальняя кинетика.' },
];

export const TRACK_BY_ID: Record<string, TrackDef> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));

/** XP required to be at this level. Index = level. */
export const PROF_XP = [0, 40, 120, 280, 560, 1000];

export function profLevel(xp: number): number {
  let level = 0;
  for (let i = 1; i < PROF_XP.length; i++) if (xp >= PROF_XP[i]!) level = i;
  return level;
}

export interface Gate {
  track: string;
  level: number;
}

export const HULL_TRACK: Record<string, string> = {
  iskra: 'hull.scout',
  klinok: 'hull.strike',
  korob: 'hull.hauler',
  oplot: 'hull.cruiser',
  monolit: 'hull.capital',
  zhargi_cruiser: 'hull.cruiser',
  omnir_carrier: 'hull.hauler',
};

export const HULL_GATES: Record<string, Gate[]> = {
  klinok: [{ track: 'hull.scout', level: 2 }],
  oplot: [{ track: 'hull.strike', level: 3 }],
  monolit: [{ track: 'hull.cruiser', level: 4 }],
  zhargi_cruiser: [{ track: 'hull.strike', level: 3 }],
};

/** Minimum faction rank at the selling station. */
export const HULL_RANK: Record<string, number> = {
  oplot: 3,
  monolit: 4,
  zhargi_cruiser: 3,
};

export const WEAPON_GROUP: Record<string, string> = {
  igla: 'wep.kinetic',
  igla2: 'wep.kinetic',
  luch: 'wep.energy',
  zhar: 'wep.energy',
  zhar2: 'wep.energy',
  korona: 'wep.energy',
  oskol: 'wep.missile',
  rels: 'wep.rail',
  plazma: 'wep.energy',
};

export function weaponGate(moduleId: string, tech: number): Gate | null {
  const track = WEAPON_GROUP[moduleId];
  if (!track || tech <= 1) return null;
  return { track, level: tech === 2 ? 2 : 4 };
}

export interface RankDef {
  level: number;
  name: string;
  min: number;
}

export const RANKS: RankDef[] = [
  { level: 0, name: 'Изгой', min: -100 },
  { level: 1, name: 'Незнакомец', min: -15 },
  { level: 2, name: 'Знакомый', min: 8 },
  { level: 3, name: 'Гость дока', min: 25 },
  { level: 4, name: 'Партнёр', min: 45 },
  { level: 5, name: 'Посланник', min: 70 },
];

export function rankOf(rep: number): RankDef {
  let best = RANKS[0]!;
  for (const rank of RANKS) if (rep >= rank.min) best = rank;
  return best;
}

export function zeroSkills(): SkillSet {
  return { aim: 0, helm: 0, engineering: 0, trade: 0, charm: 0, lead: 0, survey: 0 };
}

const CAREER_SKILLS: Record<CareerId, Partial<SkillSet>> = {
  trader: { trade: 2, charm: 1 },
  soldier: { aim: 2, engineering: 1, lead: 1 },
  hunter: { aim: 2, survey: 1 },
  explorer: { survey: 2, helm: 1 },
  pirate: { aim: 2, helm: 1 },
};

const RACE_SKILLS: Record<PlayableRace, Partial<SkillSet>> = {
  human: { charm: 1, lead: 1 },
  zhargi: { engineering: 1, aim: 1 },
  kvissae: { trade: 1, helm: 1 },
  taeyori: { survey: 1 },
  virex: { engineering: 1 },
};

const CAREER_PROF: Record<CareerId, Record<string, number>> = {
  trader: { 'hull.hauler': 2, 'wep.energy': 1 },
  soldier: { 'hull.scout': 2, 'hull.strike': 1, 'wep.kinetic': 2 },
  hunter: { 'hull.scout': 2, 'hull.strike': 1, 'wep.rail': 2, 'wep.kinetic': 1 },
  explorer: { 'hull.scout': 2, 'wep.energy': 1 },
  pirate: { 'hull.scout': 2, 'hull.strike': 1, 'wep.kinetic': 2, 'wep.energy': 1 },
};

export function careerSkills(race: PlayableRace, career: CareerId): SkillSet {
  const skills = zeroSkills();
  const add = (part: Partial<SkillSet>) => {
    for (const key of SKILL_IDS) skills[key] = Math.min(SKILL_MAX, skills[key] + (part[key] ?? 0));
  };
  add(RACE_SKILLS[race]);
  add(CAREER_SKILLS[career]);
  return skills;
}

export function careerProficiency(career: CareerId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [track, level] of Object.entries(CAREER_PROF[career])) {
    out[track] = PROF_XP[level] ?? 0;
  }
  return out;
}

export function trackLevel(proficiency: Record<string, number>, track: string): number {
  return profLevel(proficiency[track] ?? 0);
}

export function gateText(proficiency: Record<string, number>, gates: Gate[]): string | null {
  for (const gate of gates) {
    const have = trackLevel(proficiency, gate.track);
    if (have < gate.level) {
      const name = TRACK_BY_ID[gate.track]?.name ?? gate.track;
      return `${name} ${have}/${gate.level}`;
    }
  }
  return null;
}

export function factionIds(): FactionId[] {
  return ['human', 'zhargi', 'kvissae', 'taeyori', 'virex', 'pirate'];
}
