import { CAREERS, CAREER_BY_ID, DIFF_LABEL, ECON_LABEL, INVADER_LABEL, RACE_INFO, RACE_ORDER, SIZE_LABEL, introText, skillsFor } from '../sim/origin';
import { FACTION_BLURB, FACTION_LORE, FACTION_NAME, FACTION_SHORT, HULL_BY_ID } from '../sim/content';
import {
  PROF_XP,
  RANKS,
  SKILLS,
  SKILL_MAX,
  TRACKS,
  HULL_GATES,
  HULL_RANK,
  gateText,
  pointsEarned,
  profLevel,
  rankOf,
  xpToNextPoint,
} from '../sim/progress';
import type { CareerId, Difficulty, EconomyMood, GalaxySize, InvaderMood, PlayableRace, Player, World } from '../sim/types';

export interface Draft {
  race: PlayableRace;
  career: CareerId;
  name: string;
  portrait: number;
  size: GalaxySize;
  difficulty: Difficulty;
  invaders: InvaderMood;
  economy: EconomyMood;
  seed: string;
}

export function mainMenuHtml(hasSave: boolean): string {
  return `<div class="menu-card"><h1>КРОМКА</h1><p class="sub">Живая пустота. Каждое зерно — другая галактика. Карьера только толкает в начале: дальше решает, чем вы летаете и с кем торгуете.</p><div class="stack"><button type="button" class="primary" data-act="new">Новая игра</button><button type="button" data-act="continue" ${hasSave ? '' : 'disabled'}>Продолжить</button><button type="button" data-act="load">Загрузить</button><label class="file-btn">Импорт сохранения<input id="import-file" type="file" accept="application/json,.json"><span class="file-name">Файл не выбран</span></label><button type="button" data-act="lore">Народы</button><button type="button" data-act="settings">Настройки</button><button type="button" data-act="help">Управление</button></div></div>`;
}

export function loadHtml(world: World | null): string {
  if (!world) {
    return `<div class="menu-card"><h2>Загрузить</h2><p class="sub">На этом устройстве пусто. Импортируйте файл с другого.</p><label class="file-btn">Импорт сохранения<input id="import-file" type="file" accept="application/json,.json"><span class="file-name">Файл не выбран</span></label><button type="button" data-act="back-menu">Назад</button></div>`;
  }
  const origin = world.player.origin;
  const career = origin ? CAREER_BY_ID[origin.career].name : 'капитан';
  const race = origin ? FACTION_SHORT[origin.race] : 'Вольный';
  return `<div class="menu-card"><h2>Сохранение на устройстве</h2><p><b>${esc(world.player.name)}</b> · ${esc(race)} · ${esc(career)}</p><p class="sub">Зерно ${world.seed} · ${clock(world.time)} · ${Math.round(world.player.credits).toLocaleString('ru-RU')} кр.</p><div class="stack"><button type="button" class="primary" data-act="continue">Открыть</button><button type="button" data-act="back-menu">Назад</button></div></div>`;
}

export function loreHtml(): string {
  const ids = [...RACE_ORDER, 'omnir' as const];
  const cards = ids.map((id) => {
    const lore = FACTION_LORE[id];
    return `<article class="lore-card"><h3>${esc(FACTION_NAME[id])}</h3><p>${esc(lore.story)}</p><p class="sub">${esc(lore.ships)}</p><p class="sub">${esc(lore.play)}</p><p class="sub">${esc(lore.voice)}</p></article>`;
  }).join('');
  return `<div class="menu-card wide"><h2>Народы</h2><div class="lore">${cards}</div><button type="button" data-act="back-menu">Назад</button></div>`;
}

export function settingsHtml(soundOn: boolean, quality: string): string {
  const q = (id: string, label: string) => `<button type="button" data-act="quality" data-q="${id}" class="${quality === id ? 'on' : ''}">${label}</button>`;
  return `<div class="menu-card"><h2>Настройки</h2><p class="sub">Пауза только в меню и когда вкладка скрыта. Качество картинки само ставится по телефону или компьютеру, его можно сменить.</p><div class="row">${q('auto', 'Авто')}${q('low', 'Низкое')}${q('medium', 'Среднее')}${q('high', 'Высокое')}</div><div class="stack"><button type="button" data-act="sound">Звук: ${soundOn ? 'вкл' : 'выкл'}</button><button type="button" data-act="back-menu">Назад</button></div></div>`;
}

export function wizardHtml(step: string, draft: Draft): string {
  const back = `<button type="button" data-act="wiz-back">Назад</button>`;
  if (step === 'race') {
    const cards = RACE_ORDER.map((race) => {
      const on = draft.race === race ? ' on' : '';
      return `<button type="button" class="choice${on}" data-act="pick-race" data-race="${race}"><canvas class="face" data-race="${race}" data-face="1" width="84" height="110"></canvas><span><b>${esc(FACTION_NAME[race])}</b><span>${esc(FACTION_BLURB[race])}</span><span>${esc(RACE_INFO[race].bonus)}</span></span></button>`;
    }).join('');
    return `<div class="menu-card wide"><h2>Народ</h2><p class="sub">Шаг 1 из 4. Бонус только на старте, звание потом копится само.</p><div class="choices">${cards}</div><div class="row">${back}</div></div>`;
  }
  if (step === 'career') {
    const cards = CAREERS.map((career) => {
      const on = draft.career === career.id ? ' on' : '';
      const hull = HULL_BY_ID[career.hullId]?.name ?? career.hullId;
      return `<button type="button" class="choice${on}" data-act="pick-career" data-career="${career.id}"><canvas class="badge" data-career="${career.id}" width="42" height="42"></canvas><b>${esc(career.name)}</b><span>${esc(career.blurb)} Корпус «${esc(hull)}», ${career.credits.toLocaleString('ru-RU')} кр.</span></button>`;
    }).join('');
    return `<div class="menu-card wide"><h2>Старт</h2><p class="sub">Шаг 2 из 4. Это не класс навсегда: другой корпус откроется, когда освоите предыдущий.</p><div class="choices">${cards}</div><div class="row">${back}</div></div>`;
  }
  if (step === 'face') {
    return `<div class="menu-card"><h2>Капитан</h2><p class="sub">Шаг 3 из 4. Готовые лица народа. Вариант ${draft.portrait}.</p><canvas id="portrait" width="180" height="230"></canvas><div class="row"><button type="button" data-act="face-prev">←</button><button type="button" data-act="roll-face">Случайный</button><button type="button" data-act="face-next">→</button></div><div class="stack"><label>Имя<input id="hero-name" maxlength="24" value="${esc(draft.name)}"></label><div class="row">${back}<button type="button" class="primary" data-act="wiz-next">Дальше</button></div></div></div>`;
  }
  if (step === 'galaxy') {
    return `<div class="menu-card wide"><h2>Край</h2><p class="sub">Шаг 4 из 4.</p>${choiceRow('size', draft.size, SIZE_LABEL)}<h3>Сложность</h3>${choiceRow('difficulty', draft.difficulty, DIFF_LABEL)}<h3>Абсолют</h3>${choiceRow('invaders', draft.invaders, INVADER_LABEL)}<h3>Биржа</h3>${choiceRow('economy', draft.economy, ECON_LABEL)}<label>Зерно<input id="galaxy-seed" inputmode="numeric" value="${esc(draft.seed)}"></label><div class="row"><button type="button" data-act="roll-seed">Случайное зерно</button>${back}<button type="button" class="primary" data-act="wiz-tale">Дальше</button></div></div>`;
  }
  const career = CAREER_BY_ID[draft.career];
  const text = introText(
    { race: draft.race, career: draft.career, portrait: draft.portrait, skills: skillsFor(draft.race, draft.career) },
    'домашний док',
    'родную систему',
  );
  return `<div class="menu-card"><h2>Шлюз</h2><canvas id="portrait" width="120" height="150"></canvas><p>${esc(text)}</p><p class="sub">${esc(FACTION_SHORT[draft.race])} · ${esc(career.name)} · зерно ${esc(draft.seed || 'случайное')}</p><div class="row">${back}<button type="button" class="primary" data-act="launch">Выйти в док</button></div></div>`;
}

function choiceRow<T extends string>(key: string, current: T, labels: Record<T, [string, string]>): string {
  return `<div class="choices compact">${(Object.keys(labels) as T[]).map((id) => `<button type="button" class="choice${id === current ? ' on' : ''}" data-act="pick-set" data-key="${key}" data-value="${id}"><b>${esc(labels[id][0])}</b><span>${esc(labels[id][1])}</span></button>`).join('')}</div>`;
}

export function pilotHtml(player: Player): string {
  const unspent = pointsEarned(player.xp) - player.spent;
  const bar = xpToNextPoint(player.xp);
  const skills = SKILLS.map((skill) => {
    const level = player.skills[skill.id] ?? 0;
    return `<div class="skill"><div><b>${esc(skill.name)}</b> ${level}/${SKILL_MAX}<div class="sub">${esc(skill.perLevel)}</div></div><button type="button" data-act="train" data-skill="${skill.id}" ${unspent > 0 && level < SKILL_MAX ? '' : 'disabled'}>+</button></div>`;
  }).join('');
  const tracks = TRACKS.map((track) => {
    const xp = player.proficiency[track.id] ?? 0;
    const level = profLevel(xp);
    const prev = PROF_XP[level] ?? 0;
    const next = PROF_XP[Math.min(PROF_XP.length - 1, level + 1)] ?? prev + 1;
    const pct = level >= PROF_XP.length - 1 ? 100 : Math.round(((xp - prev) / Math.max(1, next - prev)) * 100);
    return `<div class="skill"><div><b>${esc(track.name)}</b> ${level}<div class="sub">${esc(track.blurb)}</div><i class="meter" style="width:${pct}%"></i></div></div>`;
  }).join('');
  const ranks = (['human', 'kvissae', 'zhargi', 'taeyori', 'virex', 'pirate'] as const).map((id) => {
    const rep = Math.round(player.reputation[id] ?? 0);
    const rank = rankOf(rep);
    return `<span>${esc(FACTION_SHORT[id])}: ${esc(rank.name)} (${rep})</span>`;
  }).join('');
  const career = CAREER_BY_ID[player.origin.career];
  const hullNotes = ['klinok', 'oplot', 'monolit'].map((id) => {
    const gate = gateText(player.proficiency, HULL_GATES[id] ?? []);
    const rankNeed = HULL_RANK[id] ?? 0;
    const hull = HULL_BY_ID[id]?.name ?? id;
    return `<li>«${esc(hull)}»: ${gate ? esc(gate) : 'освоение есть'}${rankNeed ? `, звание ${esc(RANKS.find((r) => r.level === rankNeed)?.name ?? '')}` : ''}</li>`;
  }).join('');
  return `<div class="menu-card wide pilot"><div class="pilot-head"><canvas id="portrait" width="96" height="120"></canvas><div><h2>${esc(player.name)}</h2><p class="sub">${esc(FACTION_NAME[player.origin.race])} · старт «${esc(career.name)}», это не клетка</p><p>Свободно очков: ${unspent}. До следующего: ${bar.have}/${bar.need} опыта.</p></div></div><h3>Навыки</h3>${skills}<h3>Освоение</h3>${tracks}<h3>Звания</h3><p class="ranks">${ranks}</p><h3>Что ещё закрыто</h3><ul>${hullNotes}</ul><button type="button" data-act="close-pilot">Закрыть</button></div>`;
}

function clock(time: number): string {
  const s = Math.floor(time);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}
