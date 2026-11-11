import type { DamageType, FactionId, GoodDef, HullDef, ModuleDef, PlayableRace, Resists, Role } from './types';

export const FACTION_NAME: Record<FactionId, string> = {
  human: 'Люди',
  kvissae: 'Квиссаэ',
  zhargi: 'Зхарги',
  taeyori: 'Тэйори',
  virex: 'Вирексы',
  omnir: 'Омнир',
  free: 'Вольные воды',
  pirate: 'Ржавые клинки',
};

export const FACTION_SHORT: Record<FactionId, string> = {
  human: 'Люди',
  kvissae: 'Квиссаэ',
  zhargi: 'Зхарги',
  taeyori: 'Тэйори',
  virex: 'Вирексы',
  omnir: 'Омнир',
  free: 'Вольные',
  pirate: 'Пираты',
};

export const FACTION_COLOR: Record<FactionId, string> = {
  human: '#8fb4d8',
  kvissae: '#e6c36a',
  zhargi: '#e25a28',
  taeyori: '#b388ff',
  virex: '#d08a4a',
  omnir: '#ff3348',
  free: '#8aa0b8',
  pirate: '#ff4d5e',
};

/** Engine plume. Тэйори не жгут след: у них нет двигателей. */
export const FACTION_ENGINE: Record<FactionId, string> = {
  human: '#7ecbff',
  kvissae: '#3ed6c5',
  zhargi: '#ffb15a',
  taeyori: '#d7c4ff',
  virex: '#7ecbff',
  omnir: '#ff2a3a',
  free: '#9fd4ff',
  pirate: '#ff7a45',
};

export const FACTION_SHOT: Record<FactionId, string> = {
  human: '#b9dcff',
  kvissae: '#7dfff0',
  zhargi: '#ff8a3d',
  taeyori: '#e4d2ff',
  virex: '#7eb6ff',
  omnir: '#ff3355',
  free: '#d5e4ff',
  pirate: '#ff5a6a',
};

export const PLAYER_COLOR = '#9fd4ff';

export interface RaceLore {
  story: string;
  ships: string;
  play: string;
  voice: string;
}

export const FACTION_LORE: Record<PlayableRace | 'omnir', RaceLore> = {
  human: {
    story: 'Пришли в космос последними и выжили гибкостью. Ладят со всеми, потому что не держатся за одну доктрину.',
    ships: 'Серо-синие, ионные, но классы не похожи: истребитель на двух балках с кабиной-пузырём, фрегат с вращающимся поясом турелей, грузовик-хребет со съёмными контейнерами, широкий носитель. Пятый корпус — штабная башня на коротком киле.',
    play: 'Дипломатия и смешанные экипажи. Свободный фит: +12% сети и процессора. Своё оружие — кинетика и ракеты.',
    voice: 'Коротко, по делу, без клятвы и без торга.',
  },
  zhargi: {
    story: 'Каменная плоть с магмой. Вулканический мир с тяжёлой гравитацией. Плавят металл теплом ладоней, живут веками и долго помнят обиду.',
    ships: 'Базальт, бронза и аметист: диск-клинок, обелиск, черепаха-трюм, крейсер «Жила», кузня-наковальня и цитадель.',
    play: 'Толстая броня, которая сама затягивается, слабый щит, тяжёлые масс-драйверы, медленный ход. Железо, никель и вольфрам у них дешёвые. Обиду держат долго.',
    voice: 'Мало слов, много жара. Обиду называют по имени.',
  },
  kvissae: {
    story: 'Птицеподобные, пальцы на крыльях, острое зрение. Стаи на парящих скалах. Торговля у них вместо религии, перья меняют цвет по настроению.',
    ships: 'Птичий род, классы разные: стриж, хищник, цапля-грузовоз, веерный крейсер, диск-купец. Золото и бирюза.',
    play: 'Скорость, щиты, груз и лучшие цены. Лазеры и термал. Броня тонкая.',
    voice: 'Сначала цена, потом приветствие. Перья в словах яркие.',
  },
  taeyori: {
    story: 'Парящие светящиеся медузы с кристаллическим ядром, без рук. Миллионы лет в океане газового гиганта. Телекинез и общий разум: помнят всё, что видел каждый. Кристаллы выращивают и «выпевают», и те работают как машины.',
    ships: 'Выращенные кристаллы: игла, диск, жеода, собор. Плавающие сегменты и кольца рун вокруг ядра. Двигателей нет.',
    play: 'Кристаллический щит быстро встаёт, дальние ЭМ-копья, инерционный ход. Корабли дороги. Кристаллы Тэйори — их валюта.',
    voice: 'Хор, не голос. Говорят «мы» и не торопят ответ.',
  },
  virex: {
    story: 'Слабое тело и десятки тонких манипуляторов. На суровой планете заменили себя механизмами: не понять, где плоть, а где прибор. Апгрейд для них ступень взросления.',
    ships: 'Мутировавшие кибер-насекомые: оса, жук, моль, богомол, краб. Медь и чёрный, чтобы не слиться с роем.',
    play: 'Дроны, РЭБ, мины и дистанционный ремонт. Сенсоры острые. Обслуживание дорогое, редкоземельные жрут.',
    voice: 'Номер сборки, затем просьба. Вежливость как протокол.',
  },
  omnir: {
    story: 'Не народ, а процесс. Поглощает органику и металл, встраивает чужие технологии и подстраивает сопротивления под оружие, которым его бьют. Разум один. Откуда начался — тайна сюжета.',
    ships: 'Хищные разные формы: жало, клешня, личинка, панцирь, пасть. Красные жилы бьются двойным ударом и затихают; в бою пульс чаще.',
    play: 'Неиграбелен. Броня подстраивается под тип урона. Носитель «Пасть» собирает биомассу и глотает обломки.',
    voice: 'Ответа нет. Только помеха и чужие обрывки.',
  },
};

export const FACTION_BLURB: Record<FactionId, string> = {
  human: FACTION_LORE.human.story,
  kvissae: FACTION_LORE.kvissae.story,
  zhargi: FACTION_LORE.zhargi.story,
  taeyori: FACTION_LORE.taeyori.story,
  virex: FACTION_LORE.virex.story,
  omnir: FACTION_LORE.omnir.story,
  free: 'Нейтральные трассы без флага. Здесь дешевле товар и чаще засады.',
  pirate: 'Сборная соль трасс. Считают добычу, риск и путь к отходу.',
};

export function dockGreeting(owner: FactionId, station: string): string {
  if (owner === 'human') return `${station}: «Шлюз открыт. Стоянка по общему тарифу.»`;
  if (owner === 'zhargi') return `${station}: «Металл цел. Обиды — нет. Пока.»`;
  if (owner === 'kvissae') return `${station}: «Перо к перу. Сначала цена, потом причал.»`;
  if (owner === 'taeyori') return `${station}: «Мы уже помним ваш корпус. Входите без стука.»`;
  if (owner === 'virex') return `${station}: «Стыковка принята. Обслуживание тарифицируется.»`;
  if (owner === 'pirate') return `${station}: «Пушки в кобуру. Здесь считают добычу, не флаги.»`;
  return `${station}: «Причал свободен.»`;
}

export function hailVoice(faction: FactionId, role: Role, name: string, station: boolean): string {
  if (station) {
    if (faction === 'zhargi') return `${name}: горн слушает. Говорите коротко.`;
    if (faction === 'kvissae') return `${name}: канал открыт. Назовите товар или уходите с вектора.`;
    if (faction === 'taeyori') return `${name}: мы слышим. Ответ придёт, когда хор согласится.`;
    if (faction === 'virex') return `${name}: протокол связи. Назовите сборку и запрос.`;
    if (faction === 'human') return `${name}: на связи. Чем помочь?`;
    return `${name}: шлюз слушает.`;
  }
  if (faction === 'omnir') return `${name} отвечает только помехами и чужими обрывками.`;
  if (faction === 'zhargi') return `${name}: «Говори. Обиду я запомню дольше, чем ты.»`;
  if (faction === 'kvissae') return role === 'trader' ? `${name}: «Курс живой. Не стой на моём ветре.»` : `${name}: «Перья спокойные. Пока.»`;
  if (faction === 'taeyori') return `${name}: «Мы видим вас. Спешить некому.»`;
  if (faction === 'virex') return `${name}: «Канал чистый. Дроны на поводке, не дёргайтесь.»`;
  if (role === 'pirate') return `${name}: «Груз или пыль. Выбирай быстро.»`;
  return `${name}: «На связи. Дистанцию держите.»`;
}

export const ROLE_NAME: Record<Role, string> = {
  trader: 'торговец',
  hunter: 'охотник',
  pirate: 'пират',
  defender: 'патруль',
  explorer: 'разведчик',
  invader: 'рой',
};

export const DTYPE_NAME: Record<DamageType, string> = {
  em: 'ЭМ',
  thermal: 'термал',
  kinetic: 'кинетика',
  explosive: 'взрыв',
};

export const DTYPE_COLOR: Record<DamageType, string> = {
  em: '#7eb6ff',
  thermal: '#ff7a45',
  kinetic: '#d7d2c4',
  explosive: '#ffb020',
};

const SH_FR: Resists = { em: 0, thermal: 0.2, kinetic: 0.4, explosive: 0.5 };
const AR_FR: Resists = { em: 0.5, thermal: 0.35, kinetic: 0.25, explosive: 0.1 };

function resist(base: Resists, add: number): Resists {
  return {
    em: Math.min(0.82, base.em + add),
    thermal: Math.min(0.82, base.thermal + add),
    kinetic: Math.min(0.82, base.kinetic + add),
    explosive: Math.min(0.82, base.explosive + add),
  };
}

export const HULLS: HullDef[] = [
  {
    id: 'iskra',
    name: 'Искра',
    cls: 'разведчик',
    blurb: 'Лёгкий корпус вольных капитанов. Быстрый, тесный по сетке, три захвата.',
    price: 8000,
    tech: 1,
    high: 2,
    mid: 2,
    low: 2,
    rig: 1,
    pg: 45,
    cpu: 165,
    cal: 200,
    shield: 300,
    armor: 240,
    hull: 260,
    shieldRegen: 4,
    armorRegen: 0,
    cap: 380,
    capRegen: 7,
    speed: 340,
    cargo: 70,
    mass: 1.1,
    sig: 34,
    scanRes: 520,
    lockRange: 9000,
    maxLocked: 3,
    shieldResist: SH_FR,
    armorResist: AR_FR,
  },
  {
    id: 'klinok',
    name: 'Клинок',
    cls: 'ударный фрегат',
    blurb: 'Короткий нож трасс. Больше брони и слотов под захват и орудия.',
    price: 48000,
    tech: 2,
    high: 3,
    mid: 2,
    low: 3,
    rig: 2,
    pg: 78,
    cpu: 220,
    cal: 280,
    shield: 520,
    armor: 680,
    hull: 500,
    shieldRegen: 6,
    armorRegen: 0,
    cap: 540,
    capRegen: 9,
    speed: 285,
    cargo: 55,
    mass: 1.55,
    sig: 48,
    scanRes: 430,
    lockRange: 12000,
    maxLocked: 4,
    shieldResist: { ...SH_FR, kinetic: 0.46 },
    armorResist: AR_FR,
  },
  {
    id: 'korob',
    name: 'Короб',
    cls: 'грузовоз',
    blurb: 'Честный трюм Конгломерата. Медленный, вместительный, почти без зубов.',
    price: 36000,
    tech: 1,
    high: 1,
    mid: 2,
    low: 3,
    rig: 2,
    pg: 90,
    cpu: 200,
    cal: 300,
    shield: 400,
    armor: 460,
    hull: 700,
    shieldRegen: 3,
    armorRegen: 0,
    cap: 500,
    capRegen: 6,
    speed: 150,
    cargo: 760,
    mass: 3.4,
    sig: 120,
    scanRes: 260,
    lockRange: 8000,
    maxLocked: 2,
    shieldResist: SH_FR,
    armorResist: resist(AR_FR, 0.05),
  },
  {
    id: 'oplot',
    name: 'Оплот',
    cls: 'крейсер',
    blurb: 'Рабочая лошадь патрулей. Держит точку и тащит серьёзный фит.',
    price: 175000,
    tech: 3,
    high: 4,
    mid: 3,
    low: 4,
    rig: 3,
    pg: 460,
    cpu: 420,
    cal: 400,
    shield: 1700,
    armor: 1900,
    hull: 1500,
    shieldRegen: 12,
    armorRegen: 0,
    cap: 1500,
    capRegen: 18,
    speed: 170,
    cargo: 250,
    mass: 5.2,
    sig: 150,
    scanRes: 210,
    lockRange: 17000,
    maxLocked: 5,
    shieldResist: SH_FR,
    armorResist: AR_FR,
  },
  {
    id: 'monolit',
    name: 'Монолит',
    cls: 'линкор',
    blurb: 'Редкая верфь собирает его месяцами. Медленный и почти несдвигаемый.',
    price: 780000,
    tech: 4,
    high: 6,
    mid: 4,
    low: 5,
    rig: 3,
    pg: 1200,
    cpu: 600,
    cal: 520,
    shield: 4400,
    armor: 5200,
    hull: 3800,
    shieldRegen: 22,
    armorRegen: 0,
    cap: 3000,
    capRegen: 30,
    speed: 100,
    cargo: 420,
    mass: 12,
    sig: 340,
    scanRes: 130,
    lockRange: 22000,
    maxLocked: 7,
    shieldResist: resist(SH_FR, 0.04),
    armorResist: resist(AR_FR, 0.04),
  },
  {
    id: 'zhargi_cruiser',
    name: 'Жила',
    cls: 'крейсер Зхаргов',
    blurb: 'Кованый крейсер между обелиском и кузней. Двенадцать гнёзд, толстая броня, ход тяжёлый.',
    price: 210000,
    tech: 3,
    high: 5,
    mid: 3,
    low: 4,
    rig: 2,
    pg: 520,
    cpu: 380,
    cal: 420,
    shield: 900,
    armor: 2800,
    hull: 1900,
    shieldRegen: 4,
    armorRegen: 6,
    cap: 1400,
    capRegen: 14,
    speed: 145,
    cargo: 180,
    mass: 6.4,
    sig: 170,
    scanRes: 180,
    lockRange: 15000,
    maxLocked: 5,
    shieldResist: { em: 0, thermal: 0.12, kinetic: 0.28, explosive: 0.36 },
    armorResist: resist(AR_FR, 0.08),
  },
  {
    id: 'omnir_carrier',
    name: 'Пасть',
    cls: 'носитель Омнир',
    blurb: 'У роя нет торговца. Носитель глотает обломки и тащит биомассу. Медленный и голодный.',
    price: 260000,
    tech: 5,
    high: 2,
    mid: 2,
    low: 3,
    rig: 2,
    pg: 240,
    cpu: 180,
    cal: 260,
    shield: 700,
    armor: 1600,
    hull: 2200,
    shieldRegen: 2,
    armorRegen: 4,
    cap: 900,
    capRegen: 8,
    speed: 110,
    cargo: 980,
    mass: 8.5,
    sig: 260,
    scanRes: 140,
    lockRange: 9000,
    maxLocked: 3,
    shieldResist: { em: 0.1, thermal: 0.1, kinetic: 0.1, explosive: 0.1 },
    armorResist: { em: 0.15, thermal: 0.15, kinetic: 0.15, explosive: 0.15 },
  },
];

export const HULL_BY_ID: Record<string, HullDef> = Object.fromEntries(HULLS.map((h) => [h.id, h]));

/** On-screen class scale. Capitals stay at most 3.25× a fighter. */
export function hullBulk(hullId: string): number {
  if (hullId === 'klinok') return 1.45;
  if (hullId === 'korob') return 1.75;
  if (hullId === 'zhargi_cruiser') return 2.15;
  if (hullId === 'oplot') return 2.4;
  if (hullId === 'omnir_carrier') return 2.8;
  if (hullId === 'monolit') return 3.25;
  return 1;
}

/** World-unit spacing so drawn hulls do not sit on top of each other. */
export function crowdRadius(hullId: string): number {
  return 78 * hullBulk(hullId);
}

function mod(p: ModuleDef): ModuleDef {
  return p;
}

export const MODULES: ModuleDef[] = [
  mod({
    id: 'igla',
    name: 'Автопушка «Игла»',
    blurb: 'Кинетика ближней орбиты. Хорошо берёт щит, если держать дистанцию оптимума.',
    slot: 'high',
    tech: 1,
    cpu: 16,
    pg: 7,
    cal: 0,
    price: 2200,
    weapon: { dps: 24, type: 'kinetic', optimal: 420, falloff: 900, tracking: 0.55, cycle: 1.4, cap: 6 },
  }),
  mod({
    id: 'luch',
    name: 'Импульс «Луч»',
    blurb: 'ЭМ-лазер средней дистанции. Бьёт броню и позволяет держаться дальше «Троса».',
    slot: 'high',
    tech: 1,
    cpu: 22,
    pg: 6,
    cal: 0,
    price: 2800,
    weapon: { dps: 18, type: 'em', optimal: 980, falloff: 520, tracking: 0.34, cycle: 2.0, cap: 10 },
  }),
  mod({
    id: 'zhar',
    name: 'Термал «Жар»',
    blurb: 'Короткий тепловой луч. Больно по броне, если вас пустили вплотную.',
    slot: 'high',
    tech: 1,
    cpu: 20,
    pg: 9,
    cal: 0,
    price: 3200,
    weapon: { dps: 26, type: 'thermal', optimal: 360, falloff: 380, tracking: 0.46, cycle: 1.7, cap: 12 },
  }),
  mod({
    id: 'oskol',
    name: 'Ракеты «Осколок»',
    blurb: 'Взрывной залп. Увереннее ложится в крупные сигнатуры.',
    slot: 'high',
    tech: 1,
    cpu: 24,
    pg: 5,
    cal: 0,
    price: 3600,
    weapon: { dps: 20, type: 'explosive', optimal: 760, falloff: 860, tracking: 0.3, cycle: 3.0, cap: 14 },
  }),
  mod({
    id: 'rels',
    name: 'Рельса «Нить»',
    blurb: 'Дальняя кинетика. На орбите фрегата часто мажет.',
    slot: 'high',
    tech: 2,
    cpu: 26,
    pg: 12,
    cal: 0,
    price: 7400,
    weapon: { dps: 22, type: 'kinetic', optimal: 1700, falloff: 700, tracking: 0.16, cycle: 3.1, cap: 16 },
  }),
  mod({
    id: 'plazma',
    name: 'Плазма «Клык»',
    blurb: 'Термал в упор. Для тех, кто уже повесил замедлитель.',
    slot: 'high',
    tech: 2,
    cpu: 18,
    pg: 16,
    cal: 0,
    price: 6900,
    weapon: { dps: 36, type: 'thermal', optimal: 220, falloff: 280, tracking: 0.5, cycle: 1.5, cap: 14 },
  }),
  mod({
    id: 'igla2',
    name: 'Автопушка «Игла-II»',
    blurb: 'Средняя кинетика. Просит сетку крейсера или щедрый инжектор.',
    slot: 'high',
    tech: 2,
    cpu: 30,
    pg: 36,
    cal: 0,
    price: 12800,
    weapon: { dps: 46, type: 'kinetic', optimal: 520, falloff: 1100, tracking: 0.26, cycle: 1.7, cap: 14 },
  }),
  mod({
    id: 'zhar2',
    name: 'Термал «Жар-II»',
    blurb: 'Тяжёлый тепловой луч крейсерского класса.',
    slot: 'high',
    tech: 3,
    cpu: 36,
    pg: 40,
    cal: 0,
    price: 28000,
    weapon: { dps: 58, type: 'thermal', optimal: 780, falloff: 540, tracking: 0.18, cycle: 2.3, cap: 24 },
  }),
  mod({
    id: 'korona',
    name: 'Импульс «Корона»',
    blurb: 'Дальний ЭМ для линкоров и спокойных крейсеров.',
    slot: 'high',
    tech: 3,
    cpu: 42,
    pg: 48,
    cal: 0,
    price: 36000,
    weapon: { dps: 64, type: 'em', optimal: 1600, falloff: 800, tracking: 0.11, cycle: 2.6, cap: 30 },
  }),
  mod({
    id: 'veil',
    name: 'Генератор щита «Вуаль»',
    blurb: 'Добавляет щит. Ест процессор, почти не трогает сетку.',
    slot: 'mid',
    tech: 1,
    cpu: 30,
    pg: 1,
    cal: 0,
    price: 3100,
    shieldHp: 300,
  }),
  mod({
    id: 'veil2',
    name: 'Генератор щита «Вуаль-II»',
    blurb: 'Крейсерский пузырь щита.',
    slot: 'mid',
    tech: 2,
    cpu: 58,
    pg: 2,
    cal: 0,
    price: 14600,
    shieldHp: 780,
  }),
  mod({
    id: 'rosa',
    name: 'Насос щита «Роса»',
    blurb: 'Активно поднимает щит циклами, пока жив конденсатор.',
    slot: 'mid',
    tech: 1,
    cpu: 22,
    pg: 2,
    cal: 0,
    price: 4500,
    repairShield: { hp: 48, cycle: 3, cap: 26 },
  }),
  mod({
    id: 'poryv',
    name: 'Форсаж «Порыв»',
    blurb: 'Разгон без сильного раздувания сигнатуры. Не глушится фиксатором.',
    slot: 'mid',
    tech: 1,
    cpu: 18,
    pg: 10,
    cal: 0,
    price: 3800,
    speedMult: 1.62,
    sigMult: 1.08,
    capPerSec: 5,
  }),
  mod({
    id: 'shturm',
    name: 'Маршевый «Штурм»',
    blurb: 'Резкий разгон. Фиксатор гасит его полностью, сигнатура растёт.',
    slot: 'mid',
    tech: 2,
    cpu: 28,
    pg: 24,
    cal: 0,
    price: 16200,
    speedMult: 2.2,
    sigMult: 1.9,
    capPerSec: 16,
    mwd: true,
  }),
  mod({
    id: 'tros',
    name: 'Замедлитель «Трос»',
    blurb: 'Режет скорость цели. Держит добычу в оптимуме коротких орудий.',
    slot: 'mid',
    tech: 1,
    cpu: 24,
    pg: 1,
    cal: 0,
    price: 5200,
    web: { amount: 0.42, optimal: 1000, falloff: 420, cycle: 5, cap: 12 },
  }),
  mod({
    id: 'klinch',
    name: 'Фиксатор «Клинч»',
    blurb: 'Запрещает прыжок и глушит маршевый «Штурм».',
    slot: 'mid',
    tech: 2,
    cpu: 32,
    pg: 1,
    cal: 0,
    price: 9800,
    scram: { optimal: 760, falloff: 220, cycle: 5, cap: 10 },
  }),
  mod({
    id: 'metka',
    name: 'Целеуказатель «Метка»',
    blurb: 'Раздувает сигнатуру цели — по ней проще попадать.',
    slot: 'mid',
    tech: 1,
    cpu: 20,
    pg: 1,
    cal: 0,
    price: 4100,
    painter: { sig: 0.45, optimal: 1500, falloff: 400, cycle: 4, cap: 8 },
  }),
  mod({
    id: 'plate',
    name: 'Плита «Панцирь»',
    blurb: 'Дешёвая броня. На «Искре» часто не встаёт вместе с батареей.',
    slot: 'low',
    tech: 1,
    cpu: 8,
    pg: 20,
    cal: 0,
    price: 3400,
    armorHp: 380,
  }),
  mod({
    id: 'plate2',
    name: 'Плита «Панцирь-II»',
    blurb: 'Тяжёлая броня крейсера. Съедает сетку.',
    slot: 'low',
    tech: 2,
    cpu: 14,
    pg: 70,
    cal: 0,
    price: 15400,
    armorHp: 980,
  }),
  mod({
    id: 'shov',
    name: 'Ремкомплект «Шов»',
    blurb: 'Чинка брони циклами. Пока идёт бой, конденсатор тает.',
    slot: 'low',
    tech: 1,
    cpu: 20,
    pg: 8,
    cal: 0,
    price: 5600,
    repairArmor: { hp: 42, cycle: 4, cap: 34 },
  }),
  mod({
    id: 'klin',
    name: 'Усилитель «Клин»',
    blurb: 'Плюс к урону всех орудий корпуса.',
    slot: 'low',
    tech: 1,
    cpu: 18,
    pg: 6,
    cal: 0,
    price: 4800,
    dmgMult: 1.15,
  }),
  mod({
    id: 'klin2',
    name: 'Усилитель «Клин-II»',
    blurb: 'Более жадный усилитель урона.',
    slot: 'low',
    tech: 2,
    cpu: 28,
    pg: 10,
    cal: 0,
    price: 13200,
    dmgMult: 1.22,
  }),
  mod({
    id: 'zhila',
    name: 'Инжектор «Жила»',
    blurb: 'Добавляет энергосеть под плиты и тяжёлые орудия.',
    slot: 'low',
    tech: 1,
    cpu: 18,
    pg: 0,
    cal: 0,
    price: 5000,
    pgAdd: 28,
  }),
  mod({
    id: 'um',
    name: 'Сопроцессор «Ум»',
    blurb: 'Добавляет процессор под щиты и электронику.',
    slot: 'low',
    tech: 1,
    cpu: 0,
    pg: 1,
    cal: 0,
    price: 5000,
    cpuAdd: 48,
  }),
  mod({
    id: 'zapas',
    name: 'Батарея «Запас»',
    blurb: 'Больше конденсатора и чуть быстрее восстановление.',
    slot: 'low',
    tech: 1,
    cpu: 12,
    pg: 4,
    cal: 0,
    price: 2700,
    capAdd: 200,
    capRegenAdd: 3,
  }),
  mod({
    id: 'srez',
    name: 'Полимер «Срез»',
    blurb: 'Небольшой прирост всех сопротивлений брони.',
    slot: 'low',
    tech: 2,
    cpu: 24,
    pg: 4,
    cal: 0,
    price: 11200,
    armorResistAll: 0.08,
  }),
  mod({
    id: 'rig-range',
    name: 'Риг «Дальность»',
    blurb: 'Чуть отодвигает оптимум и спад орудий. Снимается только на верфи.',
    slot: 'rig',
    tech: 1,
    cpu: 0,
    pg: 0,
    cal: 150,
    price: 7000,
    optMult: 1.12,
    fallMult: 1.1,
  }),
  mod({
    id: 'rig-pol',
    name: 'Риг «Поляризация»',
    blurb: 'Укрепляет сопротивления щита.',
    slot: 'rig',
    tech: 1,
    cpu: 0,
    pg: 0,
    cal: 140,
    price: 8000,
    shieldResistAll: 0.1,
  }),
  mod({
    id: 'rig-hold',
    name: 'Риг «Трюм»',
    blurb: 'Расширяет грузовой отсек.',
    slot: 'rig',
    tech: 1,
    cpu: 0,
    pg: 0,
    cal: 100,
    price: 6500,
    cargoMult: 1.22,
  }),
  mod({
    id: 'rig-tug',
    name: 'Риг «Тяга»',
    blurb: 'Небольшая прибавка к скорости.',
    slot: 'rig',
    tech: 1,
    cpu: 0,
    pg: 0,
    cal: 130,
    price: 7200,
    speedMult: 1.08,
  }),
  mod({
    id: 'rig-cap',
    name: 'Риг «Ёмкость»',
    blurb: 'Быстрее возвращает конденсатор.',
    slot: 'rig',
    tech: 1,
    cpu: 0,
    pg: 0,
    cal: 90,
    price: 6000,
    capRegenMult: 1.18,
  }),
  mod({
    id: 'rig-hard',
    name: 'Риг «Закалка»',
    blurb: 'Укрепляет сопротивления брони.',
    slot: 'rig',
    tech: 2,
    cpu: 0,
    pg: 0,
    cal: 150,
    price: 9000,
    armorResistAll: 0.1,
  }),
];

export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]));

export const GOODS: GoodDef[] = [
  { id: 'fe', name: 'Железо', base: 42 },
  { id: 'ni', name: 'Никель', base: 78 },
  { id: 'ti', name: 'Титан', base: 120 },
  { id: 'cu', name: 'Медь', base: 90 },
  { id: 'al', name: 'Алюминий', base: 54 },
  { id: 'w', name: 'Вольфрам', base: 260 },
  { id: 'pt', name: 'Платина', base: 490 },
  { id: 'rare', name: 'Редкоземельные', base: 360 },
  { id: 'he3', name: 'Гелий-3', base: 140 },
  { id: 'deuterium', name: 'Дейтерий', base: 170 },
  { id: 'crystals', name: 'Кристаллы Тэйори', base: 540 },
  { id: 'biomass', name: 'Биомасса Омнир', base: 310 },
];

export const GOOD_IDS: string[] = GOODS.map((g) => g.id);
export const GOOD_BY_ID: Record<string, GoodDef> = Object.fromEntries(GOODS.map((g) => [g.id, g]));

export const PLANET_NAME: Record<string, string> = {
  volcanic: 'вулкан',
  ocean: 'океан',
  barren: 'пустошь',
  ice: 'лёд',
  gas: 'газовое',
  garden: 'сад',
  hive: 'улей',
};

export const STARTER_FIT: (string | null)[] = ['igla', null, 'veil', 'poryv', 'klin', 'zapas', null];

export function emptyRep(): Record<FactionId, number> {
  return { human: 0, kvissae: 0, zhargi: 0, taeyori: 0, virex: 0, omnir: -100, free: 0, pirate: 0 };
}

export function slotLayout(hull: HullDef): ('high' | 'mid' | 'low' | 'rig')[] {
  const s: ('high' | 'mid' | 'low' | 'rig')[] = [];
  for (let i = 0; i < hull.high; i++) s.push('high');
  for (let i = 0; i < hull.mid; i++) s.push('mid');
  for (let i = 0; i < hull.low; i++) s.push('low');
  for (let i = 0; i < hull.rig; i++) s.push('rig');
  return s;
}

export function slotLabel(slot: string, indexInType: number): string {
  const map: Record<string, string> = { high: 'Орудие', mid: 'Средний', low: 'Нижний', rig: 'Риг' };
  return `${map[slot] ?? slot} ${indexInType + 1}`;
}
