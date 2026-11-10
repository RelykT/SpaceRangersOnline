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

export const RACE_ORDER: PlayableRace[] = ['solari', 'regnar', 'nimva', 'vekt'];

export const RACE_INFO: Record<
  PlayableRace,
  { bonus: string; rep: Partial<Record<FactionId, number>> }
> = {
  solari: {
    bonus: 'Старт: +1 Торговля. Свои и Нимвы встречают теплее.',
    rep: { solari: 42, regnar: 6, nimva: 18, vekt: 8, pirate: -4 },
  },
  regnar: {
    bonus: 'Старт: +1 Техника, броня толще. С Вектами холодно.',
    rep: { solari: 4, regnar: 44, nimva: 2, vekt: -12, pirate: -8 },
  },
  nimva: {
    bonus: 'Старт: +1 Разведка, щит крепче. Солари считают вас гостем.',
    rep: { solari: 16, regnar: 2, nimva: 42, vekt: 6, pirate: -4 },
  },
  vekt: {
    bonus: 'Старт: +1 Торговля и просторный трюм.',
    rep: { solari: 10, regnar: -8, nimva: 6, vekt: 42, pirate: -6 },
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
  const friends = Math.max(0, Math.min(3, allies));
  return {
    dmg: 1 + 0.03 * friends,
    speed: 1 + 0.05 * skills.helm,
    shield: race === 'nimva' ? 1.12 : 1,
    armor: (race === 'regnar' ? 1.12 : 1) * (1 + 0.03 * skills.engineering),
    cargo: race === 'vekt' ? 1.18 : 1,
    scan: 1 + 0.08 * skills.survey,
    opt: 1 + 0.04 * skills.aim,
    pg: 1 + 0.05 * skills.engineering,
    cpu: 1 + 0.05 * skills.engineering,
    agility: 1 + 0.08 * skills.helm,
    tradeBuy: Math.max(0.7, 1 - 0.04 * skills.trade),
    tradeSell: 1 + 0.03 * skills.trade,
    repGain: 1 + 0.15 * skills.charm,
    reward: 1 + 0.04 * skills.charm,
    bounty: 1 + 0.1 * skills.lead,
    repair: Math.max(0.55, 1 - 0.06 * skills.engineering),
    explore: 1 + 0.1 * skills.survey,
  };
}

export function startingReputation(origin: CaptainOrigin): Record<FactionId, number> {
  const rep = emptyRep();
  const row = RACE_INFO[origin.race].rep;
  for (const key of Object.keys(rep) as FactionId[]) {
    if (row[key] != null) rep[key] = row[key]!;
  }
  rep.absolute = -100;
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

export function absoluteReach(mood: InvaderMood): number {
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
    solari: 'Лига выдала вам доковый жетон и вежливое предупреждение не портить курс.',
    regnar: 'Клан проводил вас до шлюза. Долг чести записан, но корабль уже ваш.',
    nimva: 'В архиве Собора осталась копия вашего имени. Щиты настроены на местную звезду.',
    vekt: 'Конгломерат отгрузил корпус в счёт будущего рейса. Накладные ещё тёплые.',
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
  sleeping: ['Дремлет', 'Абсолют сидит в своём гнезде.'],
  waking: ['Просыпается', 'Рой уже трогает соседние системы.'],
  tide: ['Прилив', 'Захваты частые, подмога роя быстрая.'],
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
