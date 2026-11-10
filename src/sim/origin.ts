import type {
  CareerId,
  CaptainOrigin,
  Difficulty,
  EconomyMood,
  FactionId,
  GalaxySettings,
  GalaxySize,
  InvaderMood,
  PlayableRace,
  SkillSet,
} from './types';
import type { FitBonus } from './fitting';
import { emptyRep } from './content';
import { careerSkills } from './progress';

export const DEFAULT_SETTINGS: GalaxySettings = {
  size: 'medium',
  difficulty: 'captain',
  invaders: 'waking',
  economy: 'live',
};

export const RACE_ORDER: PlayableRace[] = ['human', 'zhargi', 'kvissae', 'taeyori', 'virex'];

export const RACE_INFO: Record<
  PlayableRace,
  { bonus: string; rep: Partial<Record<FactionId, number>> }
> = {
  human: {
    bonus: 'Универсалы. +1 Обаяние и лидерство, +12% сети и процессора, смешанный экипаж бьёт сильнее.',
    rep: { human: 28, kvissae: 10, zhargi: 8, taeyori: 8, virex: 8, pirate: -2 },
  },
  zhargi: {
    bonus: 'Воины-кузнецы. +1 Техника и точность, толстая броня, тяжёлый залп, медленный ход. Металл дешёвый.',
    rep: { human: 6, kvissae: 2, zhargi: 44, taeyori: 0, virex: -14, pirate: -8 },
  },
  kvissae: {
    bonus: 'Торговцы. +1 Торговля и манёвр, скорость и трюм, лучшие цены, тонкая броня.',
    rep: { human: 10, kvissae: 42, zhargi: 4, taeyori: 12, virex: 8, pirate: -6 },
  },
  taeyori: {
    bonus: 'Древние. +1 Разведка, сильный щит, саморемонт, инерция, карта помнится дольше.',
    rep: { human: 8, kvissae: 12, zhargi: 2, taeyori: 42, virex: 4, pirate: -2 },
  },
  virex: {
    bonus: 'Технократы. +1 Техника, сенсоры и процессор, дорогой ремонт.',
    rep: { human: 6, kvissae: 8, zhargi: -10, taeyori: 4, virex: 42, pirate: -6 },
  },
};

export interface CareerDef {
  id: CareerId;
  name: string;
  blurb: string;
  hullId: string;
  modules: (string | null)[];
  credits: number;
  cargo: Record<string, number>;
}

export const CAREERS: CareerDef[] = [
  {
    id: 'trader',
    name: 'Торговец',
    blurb: '«Короб», полный трюм и чутьё на цену. Драться умеет плохо.',
    hullId: 'korob',
    modules: ['luch', 'veil', 'poryv', 'zapas', 'plate', 'um', 'rig-hold', 'rig-hold'],
    credits: 26000,
    cargo: { alloy: 20, food: 30 },
  },
  {
    id: 'soldier',
    name: 'Военный',
    blurb: '«Клинок» патрульного заказа. Урон и броня, деньги скромные.',
    hullId: 'klinok',
    modules: ['igla', 'luch', 'igla', 'veil', 'poryv', 'plate', 'klin', 'srez', 'rig-pol', null],
    credits: 15000,
    cargo: { cells: 4, food: 8 },
  },
  {
    id: 'hunter',
    name: 'Наёмник',
    blurb: 'Охотник за головами. Дальний выстрел, быстрый захват, награда важнее флага.',
    hullId: 'klinok',
    modules: ['rels', 'igla', 'igla', 'metka', 'poryv', 'klin', 'zapas', 'srez', 'rig-range', null],
    credits: 18000,
    cargo: { food: 8 },
  },
  {
    id: 'explorer',
    name: 'Исследователь',
    blurb: 'Лёгкая «Искра». Дальше видит, быстрее летит, в трюме чужие архивы.',
    hullId: 'iskra',
    modules: ['luch', null, 'veil', 'poryv', 'zapas', 'um', 'rig-tug'],
    credits: 14000,
    cargo: { data: 6, food: 8 },
  },
  {
    id: 'pirate',
    name: 'Пират',
    blurb: 'Чужой «Клинок» с фиксатором. Империи уже косо смотрят, в кармане пусто.',
    hullId: 'klinok',
    modules: ['igla', 'igla', 'plazma', 'klinch', 'tros', 'plate', 'klin', 'zapas', null, null],
    credits: 8000,
    cargo: { cells: 2 },
  },
];

export const CAREER_BY_ID: Record<CareerId, CareerDef> = Object.fromEntries(CAREERS.map((c) => [c.id, c])) as Record<CareerId, CareerDef>;

export function skillsFor(race: PlayableRace, career: CareerId): SkillSet {
  return careerSkills(race, career);
}

export function makeOrigin(race: PlayableRace, career: CareerId, portrait: number): CaptainOrigin {
  return { race, career, portrait: portrait >>> 0, skills: skillsFor(race, career) };
}

export function skillBonus(skills: SkillSet, race: PlayableRace, allies = 0): FitBonus & {
  tradeBuy: number;
  tradeSell: number;
  repGain: number;
  reward: number;
  bounty: number;
  repair: number;
  explore: number;
} {
  const friends = Math.max(0, Math.min(race === 'human' ? 4 : 3, allies));
  return {
    dmg: (1 + (race === 'human' ? 0.05 : 0.03) * friends) * (race === 'zhargi' ? 1.08 : 1),
    speed: (1 + 0.05 * skills.helm) * (race === 'zhargi' ? 0.86 : race === 'kvissae' ? 1.14 : race === 'taeyori' ? 0.96 : 1),
    shield: race === 'taeyori' ? 1.22 : race === 'human' ? 1.04 : 1,
    armor: (race === 'zhargi' ? 1.2 : race === 'kvissae' ? 0.78 : race === 'human' ? 1.04 : 1) * (1 + 0.03 * skills.engineering),
    cargo: (race === 'kvissae' ? 1.24 : race === 'human' ? 1.06 : 1),
    scan: (1 + 0.08 * skills.survey) * (race === 'virex' ? 1.22 : race === 'taeyori' ? 1.12 : 1),
    opt: (1 + 0.04 * skills.aim) * (race === 'virex' ? 1.06 : 1),
    pg: (1 + 0.05 * skills.engineering) * (race === 'human' ? 1.12 : 1),
    cpu: (1 + 0.05 * skills.engineering) * (race === 'human' ? 1.12 : race === 'virex' ? 1.1 : 1),
    agility: (1 + 0.08 * skills.helm) * (race === 'zhargi' ? 0.82 : race === 'taeyori' ? 0.78 : race === 'kvissae' ? 1.1 : 1),
    tradeBuy: Math.max(0.62, (1 - 0.04 * skills.trade) * (race === 'kvissae' ? 0.9 : 1)),
    tradeSell: (1 + 0.03 * skills.trade) * (race === 'kvissae' ? 1.05 : 1),
    repGain: (1 + 0.15 * skills.charm) * (race === 'human' ? 1.2 : 1),
    reward: 1 + 0.04 * skills.charm,
    bounty: 1 + 0.1 * skills.lead,
    repair: Math.max(0.5, (1 - 0.06 * skills.engineering) * (race === 'virex' ? 1.45 : race === 'zhargi' ? 0.88 : 1)),
    explore: (1 + 0.1 * skills.survey) * (race === 'taeyori' ? 1.25 : 1),
  };
}

export function startingReputation(origin: CaptainOrigin): Record<FactionId, number> {
  const rep = emptyRep();
  const row = RACE_INFO[origin.race].rep;
  for (const key of Object.keys(rep) as FactionId[]) {
    if (row[key] != null) rep[key] = row[key]!;
  }
  rep.omnir = -100;
  if (origin.career === 'pirate') {
    for (const race of RACE_ORDER) rep[race] -= 18;
    rep.pirate += 25;
    rep[origin.race] += 10;
  }
  if (origin.career === 'soldier') rep[origin.race] += 8;
  for (const key of Object.keys(rep) as FactionId[]) {
    rep[key] = Math.max(-100, Math.min(100, rep[key]));
  }
  return rep;
}

export function creditMultiplier(difficulty: Difficulty): number {
  if (difficulty === 'calm') return 1.25;
  if (difficulty === 'harsh') return 0.72;
  return 1;
}

export function systemCount(size: GalaxySize, roll: number): number {
  if (size === 'small') return 16 + Math.floor(roll * 2);
  if (size === 'large') return 40 + Math.floor(roll * 4);
  return 28 + Math.floor(roll * 5);
}

export function omnirReach(mood: InvaderMood): number {
  if (mood === 'sleeping') return 0;
  if (mood === 'tide') return 2;
  return 1;
}

export function economyVolatility(mood: EconomyMood | undefined): number {
  if (mood === 'flat') return 0.55;
  if (mood === 'storm') return 1.65;
  return 1;
}

export function pirateSecurity(difficulty: Difficulty | undefined): number {
  if (difficulty === 'calm') return 0.18;
  if (difficulty === 'harsh') return 0.42;
  return 0.3;
}

export function introText(origin: CaptainOrigin, stationName: string, systemName: string): string {
  const career = CAREER_BY_ID[origin.career].name.toLowerCase();
  const raceLine: Record<PlayableRace, string> = {
    human: 'Люди не выдают доктрину. Корабль ваш, маршрут тоже.',
    kvissae: 'Стая проводила вас до пристани и сразу назвала цену стоянки.',
    zhargi: 'Горн остыл ровно настолько, чтобы выйти. Обиды клана записаны в камень.',
    taeyori: 'Хор запомнил ваше имя целиком. Щит уже поёт в лад со звездой.',
    virex: 'Лаборатория отгрузила корпус. Счёт за обслуживание придёт отдельно.',
  };
  const jobLine: Record<CareerId, string> = {
    trader: 'Трюм пахнет сплавом. Где-то рядом цена уже врёт.',
    soldier: 'Орудия стоят на предохранителе. Патруль смотрит, как вы отходите.',
    hunter: 'В планшете пустой список голов. Первая награда где-то на трассе.',
    explorer: 'Дальние каналы на карте ещё серые. Это и есть работа.',
    pirate: 'Имперские частоты шипят. Здесь вас знают, и это не комплимент.',
  };
  return `${raceLine[origin.race]} Вы — ${career}, и шлюз ${stationName} в системе ${systemName} уже открыт. ${jobLine[origin.career]}`;
}

export const SIZE_LABEL: Record<GalaxySize, [string, string]> = {
  small: ['Тесная', 'Мало систем, короткие пути.'],
  medium: ['Обычная', 'Привычный край.'],
  large: ['Огромная', 'Долгие маршруты и чужие войны.'],
};

export const DIFF_LABEL: Record<Difficulty, [string, string]> = {
  calm: ['Спокойная', 'Меньше пиратов, больше стартовых денег.'],
  captain: ['Капитанская', 'Как живёт сам край.'],
  harsh: ['Безжалостная', 'Пираты гуще, кошелёк тоньше.'],
};

export const INVADER_LABEL: Record<InvaderMood, [string, string]> = {
  sleeping: ['Дремлет', 'Омнир сидит в своём гнезде.'],
  waking: ['Просыпается', 'Рой уже трогает соседние системы.'],
  tide: ['Прилив', 'Захваты частые, подмога Омнира быстрая.'],
};

export const ECON_LABEL: Record<EconomyMood, [string, string]> = {
  flat: ['Ровная', 'Цены почти не дышат.'],
  live: ['Живая', 'Запас и спрос двигают цену.'],
  storm: ['Шторм', 'Один рейс может обрушить рынок.'],
};

export const SKILL_LABEL: Record<keyof SkillSet, string> = {
  aim: 'Точность',
  helm: 'Манёвренность',
  engineering: 'Техника',
  trade: 'Торговля',
  charm: 'Обаяние',
  lead: 'Лидерство',
  survey: 'Разведка',
};
