import { createAudio, type AudioBus } from './audio';
import { exportGame, importGame, loadGame, saveGame } from './save';
import { GESTURE, classifyGesture, dragThreshold, type PointerKind } from '../input/gestures';
import {
  HIT_PX,
  screenToWorld,
  worldPointerAllowed,
  worldToScreen,
  pickAt,
  type Camera,
  type Pickable,
  type PickHit,
  type Rect,
} from '../input/pick';
import { drawHangar, drawMap, drawMenu, drawSplash, drawSystem, pilotSamples } from '../render/draw';
import {
  DTYPE_NAME,
  FACTION_NAME,
  FACTION_SHORT,
  hailVoice,
  GOODS,
  HULLS,
  MODULES,
  MODULE_BY_ID,
  slotLabel,
  slotLayout,
} from '../sim/content';
import { stationPrice } from '../sim/economy';
import { cargoUsed, computeFit, hullOf } from '../sim/fitting';
import { economyVolatility, skillBonus } from '../sim/origin';
import { loreHtml, mainMenuHtml, loadHtml, settingsHtml, wizardHtml, pilotHtml, type Draft } from './menus';
import { preloadArt } from '../render/art';
import { drawCareerBadge, drawEmblem, drawGoodIcon, drawModuleIcon, drawPortrait } from '../render/portrait';
import { getQuality, qualityName, setQuality } from '../render/quality';
import type { CareerId, Difficulty, EconomyMood, GalaxySize, InvaderMood, PlayableRace, Player } from '../sim/types';
import { createWorld as makeWorld } from '../sim/world';
import { dist, findPath, stationById, stationTech, systemById } from '../sim/query';
import { SIM_DT, type Command, type World } from '../sim/types';
import { step } from '../sim/world';

type Sel =
  | { kind: 'ship'; id: string }
  | { kind: 'planet'; id: string }
  | { kind: 'station'; id: string }
  | { kind: 'gate'; to: string }
  | { kind: 'wreck'; id: string };

interface PointerTrack {
  id: number;
  type: PointerKind;
  x: number;
  y: number;
  sx: number;
  sy: number;
  t: number;
  moved: number;
}

let hailLine = '';

const ORDERS: { id: string; label: string }[] = [
  { id: 'approach', label: 'Приблизиться' },
  { id: 'orbit', label: 'Орбита' },
  { id: 'keep', label: 'Держать дистанцию' },
  { id: 'lock', label: 'Захват цели' },
  { id: 'hail', label: 'Связь' },
  { id: 'dock', label: 'Пристыковаться' },
  { id: 'jump', label: 'Прыжок' },
];

export function startGame(root: HTMLElement): void {
  preloadArt();
  root.innerHTML = `
    <canvas id="view"></canvas>
    <div id="hud" class="hud" hidden>
      <header class="topbar blocker">
        <div class="brand">КРОМКА</div>
        <div class="loc" id="loc"></div>
        <div class="credits" id="credits"></div>
        <div class="bars" id="bars" title="щит, броня, корпус, конденсатор">
          <div class="bar shield"><i></i></div>
          <div class="bar armor"><i></i></div>
          <div class="bar hull"><i></i></div>
          <div class="bar cap"><i></i></div>
        </div>
        <button type="button" data-act="pilot">Пилот</button>
        <button type="button" data-act="map" id="btn-map">Карта</button>
        <button type="button" data-act="stop">Стоп</button>
        <button type="button" data-act="follow">Следить</button>
        <button type="button" data-act="help">?</button>
        <button type="button" data-act="pause">Меню</button>
      </header>
      <div class="zoom-pad blocker">
        <button type="button" data-act="zin" aria-label="Ближе">+</button>
        <button type="button" data-act="zout" aria-label="Дальше">−</button>
      </div>
      <aside id="overview" class="overview blocker"></aside>
      <div id="readout" class="readout"></div>
      <canvas id="comms" class="comms" width="84" height="110" hidden></canvas>
      <div id="modules" class="modules blocker"></div>
    </div>
    <div id="radial" class="radial blocker" hidden></div>
    <div id="picker" class="picker blocker" hidden></div>
    <div id="mapcard" class="mapcard blocker" hidden></div>
    <section id="station" class="sheet blocker" hidden></section>
    <section id="menu" class="sheet menu blocker"></section>
    <section id="pause" class="sheet blocker" hidden></section>
    <section id="help" class="sheet blocker" hidden></section>
    <section id="pilot" class="sheet blocker" hidden></section>
    <button id="splash-skip" class="splash-skip" type="button" data-act="skip-splash">Пропустить</button>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#view')!;
  const ctx = canvas.getContext('2d')!;
  const hud = root.querySelector<HTMLElement>('#hud')!;
  const overview = root.querySelector<HTMLElement>('#overview')!;
  const modulesEl = root.querySelector<HTMLElement>('#modules')!;
  const readout = root.querySelector<HTMLElement>('#readout')!;
  const radialEl = root.querySelector<HTMLElement>('#radial')!;
  const pickerEl = root.querySelector<HTMLElement>('#picker')!;
  const mapcard = root.querySelector<HTMLElement>('#mapcard')!;
  const stationEl = root.querySelector<HTMLElement>('#station')!;
  const menuEl = root.querySelector<HTMLElement>('#menu')!;
  const pauseEl = root.querySelector<HTMLElement>('#pause')!;
  const helpEl = root.querySelector<HTMLElement>('#help')!;
  const pilotEl = root.querySelector<HTMLElement>('#pilot')!;
  const audio: AudioBus = createAudio();

  let world: World | null = null;
  let mode: 'splash' | 'menu' | 'space' | 'map' = 'splash';
  let splashAt = 0;
  let menuView: 'main' | 'race' | 'career' | 'face' | 'galaxy' | 'tale' | 'settings' | 'load' | 'lore' = 'main';
  let pilotOpen = false;
  const draft: Draft = {
    race: 'kvissae',
    career: 'trader',
    name: 'Илль Сед',
    portrait: 11,
    size: 'medium',
    difficulty: 'captain',
    invaders: 'waking',
    economy: 'live',
    seed: '',
  };
  let pauseOpen = false;
  let helpOpen = false;
  let hiddenPause = false;
  let commands: Command[] = [];
  let selected: Sel | null = null;
  let mapId: string | null = null;
  let stationTab: 'market' | 'fit' | 'jobs' | 'repair' = 'market';
  let fitSlot: number | null = null;
  let stationStamp = '';
  let overviewStamp = '';
  let moduleStamp = '';
  let radial: { x: number; y: number } | null = null;
  let picker: { x: number; y: number; hits: PickHit[]; intent: 'select' | 'menu' } | null = null;
  const pointers = new Map<number, PointerTrack>();
  let longTimer = 0;
  let longFired = false;
  let gestureLock = false;
  let pinchDist = 0;
  let pinchX = 0;
  let pinchY = 0;
  let acc = 0;
  let lastT = 0;
  let alpha = 1;
  let viewW = 1;
  let viewH = 1;
  let saveTimer = 0;
  let knownPing = 0;
  let radialStamp = '';
  let pickerStamp = '';
  let mapStamp = '';
  let pauseStamp = '';
  let lootAt = 0;
  const older = new Map<string, { x: number; y: number }>();
  const newer = new Map<string, { x: number; y: number }>();
  const spaceCam: Camera & { follow: boolean } = { x: 0, y: 0, zoom: 0.38, viewW: 1, viewH: 1, follow: true };
  let spaceZoom = 0.38;
  let mapZoom = 0.3;
  const mapCam: Camera = { x: 0, y: 0, zoom: 0.3, viewW: 1, viewH: 1 };

  const queue = (command: Command) => commands.push(command);
  const paused = () => hiddenPause || pauseOpen || (helpOpen && mode !== 'menu');

  function activeCam(): Camera {
    const cam = mode === 'map' ? mapCam : spaceCam;
    cam.viewW = viewW;
    cam.viewH = viewH;
    return cam;
  }

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, getQuality().dpr);
    viewW = Math.max(1, canvas.clientWidth);
    viewH = Math.max(1, canvas.clientHeight);
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function snapshot(): void {
    if (!world) return;
    older.clear();
    for (const [k, v] of newer) older.set(k, { ...v });
    newer.clear();
    newer.set('player', { x: world.player.x, y: world.player.y });
    for (const pilot of world.pilots) newer.set(pilot.id, { x: pilot.x, y: pilot.y });
    if (older.size === 0) for (const [k, v] of newer) older.set(k, { ...v });
  }

  function sample(id: string, x: number, y: number): { x: number; y: number } {
    const a = older.get(id);
    const b = newer.get(id) ?? { x, y };
    if (!a || Math.hypot(a.x - b.x, a.y - b.y) > 900) return b;
    return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
  }

  function localPickables(): Pickable[] {
    if (!world) return [];
    const sys = systemById(world, world.player.systemId);
    if (!sys) return [];
    const list: Pickable[] = [];
    for (const id of sys.planetIds) {
      const planet = world.planets.find((p) => p.id === id);
      if (!planet) continue;
      list.push({ id: planet.id, kind: 'planet', name: planet.name, x: planet.x, y: planet.y, spriteRadius: planet.radius });
    }
    for (const id of sys.stationIds) {
      const st = world.stations.find((s) => s.id === id);
      if (!st) continue;
      list.push({ id: st.id, kind: 'station', name: st.name, x: st.x, y: st.y, spriteRadius: 90 });
    }
    for (const gate of sys.gates) {
      const other = systemById(world, gate.to);
      list.push({ id: `gate:${gate.to}`, kind: 'gate', name: `Врата: ${other?.name ?? gate.to}`, x: gate.x, y: gate.y, spriteRadius: 140 });
    }
    for (const wreck of world.wrecks) {
      if (wreck.systemId !== sys.id) continue;
      list.push({ id: wreck.id, kind: 'wreck', name: wreck.name, x: wreck.x, y: wreck.y, spriteRadius: 70 });
    }
    for (const pilot of world.pilots) {
      if (pilot.destroyed || pilot.dockedAt || pilot.jump || pilot.systemId !== sys.id) continue;
      const at = sample(pilot.id, pilot.x, pilot.y);
      list.push({ id: pilot.id, kind: 'ship', name: pilot.name, x: at.x, y: at.y, spriteRadius: 80 });
    }
    return list;
  }

  function mapPickables(): Pickable[] {
    if (!world) return [];
    return world.systems.map((sys) => ({
      id: sys.id,
      kind: 'star' as const,
      name: sys.name,
      x: sys.x,
      y: sys.y,
      spriteRadius: 48,
    }));
  }

  function pickables(): Pickable[] {
    return mode === 'map' ? mapPickables() : localPickables();
  }

  function blockerRects(): Rect[] {
    const base = canvas.getBoundingClientRect();
    const rects: Rect[] = [];
    for (const node of root.querySelectorAll<HTMLElement>('.blocker')) {
      if (node.hidden || node.closest('[hidden]')) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      rects.push({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
    }
    return rects;
  }

  function canvasPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function selectShip(id: string | null): void {
    queue({ t: 'select', id });
  }

  function applySelection(sel: Sel | null, openRadial: boolean): void {
    selected = sel;
    if (!sel || sel.kind !== 'ship') selectShip(null);
    else selectShip(sel.id);
    if (sel?.kind === 'ship') {
      const item = pickables().find((p) => p.id === sel.id);
      if (item && openRadial) openRadialAt(item);
      else if (!openRadial) radial = null;
    } else if (sel && openRadial) {
      const item = pickables().find((p) => p.id === (sel.kind === 'gate' ? `gate:${sel.to}` : sel.id));
      if (item) openRadialAt(item);
    } else radial = null;
    overviewStamp = '';
  }

  function openRadialAt(item: Pickable): void {
    const p = worldToScreen(activeCam(), item.x, item.y);
    radial = {
      x: clamp(p.x, 120, viewW - 120),
      y: clamp(p.y, 120, viewH - 140),
    };
  }

  function showPicker(hits: PickHit[], x: number, y: number, intent: 'select' | 'menu'): void {
    picker = { hits, x: clamp(x, 8, viewW - 240), y: clamp(y, 60, viewH - 220), intent };
    radial = null;
  }

  function chooseHit(hit: PickHit, intent: 'select' | 'menu'): void {
    picker = null;
    if (mode === 'map') {
      mapId = hit.item.id;
      return;
    }
    applySelection(selFromPick(hit.item), intent === 'menu');
  }

  function selFromPick(item: Pickable): Sel | null {
    if (item.kind === 'ship') return { kind: 'ship', id: item.id };
    if (item.kind === 'planet') return { kind: 'planet', id: item.id };
    if (item.kind === 'station') return { kind: 'station', id: item.id };
    if (item.kind === 'wreck') return { kind: 'wreck', id: item.id };
    if (item.kind === 'gate') return { kind: 'gate', to: item.id.slice(5) };
    return null;
  }

  function hitTest(x: number, y: number, pointer: PointerKind): PickHit[] {
    const min = pointer === 'mouse' ? HIT_PX.mouse : HIT_PX.touch;
    return pickAt(activeCam(), pickables(), x, y, min);
  }

  function onWorldTap(x: number, y: number, pointer: PointerKind): void {
    if (picker) {
      picker = null;
      return;
    }
    const hits = hitTest(x, y, pointer);
    if (mode === 'map') {
      if (hits.length === 1) mapId = hits[0]!.item.id;
      else if (hits.length > 1) showPicker(hits, x, y, 'select');
      return;
    }
    if (hits.length === 0) {
      const p = screenToWorld(activeCam(), x, y);
      queue({ t: 'dest', x: p.x, y: p.y, mode: 'approach', range: 0, followId: null });
      applySelection(null, false);
      radial = null;
      return;
    }
    if (hits.length > 1) {
      showPicker(hits, x, y, pointer === 'mouse' ? 'menu' : 'select');
      return;
    }
    const sel = selFromPick(hits[0]!.item);
    applySelection(sel, pointer === 'mouse');
  }

  function onLong(x: number, y: number): void {
    longFired = true;
    const hits = hitTest(x, y, 'touch');
    if (mode === 'map') {
      if (hits.length === 1) mapId = hits[0]!.item.id;
      else if (hits.length > 1) showPicker(hits, x, y, 'select');
      return;
    }
    if (hits.length === 1) {
      applySelection(selFromPick(hits[0]!.item), true);
    } else if (hits.length > 1) showPicker(hits, x, y, 'menu');
  }

  function orderEnabled(id: string): boolean {
    if (!selected || mode !== 'space') return false;
    if (id === 'approach' || id === 'orbit' || id === 'keep') return true;
    if (id === 'lock') return selected.kind === 'ship';
    if (id === 'hail') return selected.kind === 'ship' || selected.kind === 'station';
    if (id === 'dock') return selected.kind === 'station' || selected.kind === 'planet';
    if (id === 'jump') return selected.kind === 'gate';
    return false;
  }

  function followOf(sel: Sel): string | null {
    if (sel.kind === 'ship' || sel.kind === 'planet' || sel.kind === 'station') return sel.id;
    if (sel.kind === 'gate') return `gate:${sel.to}`;
    return null;
  }

  function focusPoint(sel: Sel): { x: number; y: number } | null {
    if (!world) return null;
    if (sel.kind === 'ship') {
      if (sel.id === 'player') return { x: world.player.x, y: world.player.y };
      const pilot = world.pilots.find((p) => p.id === sel.id);
      return pilot ? { x: pilot.x, y: pilot.y } : null;
    }
    if (sel.kind === 'planet') {
      const planet = world.planets.find((p) => p.id === sel.id);
      return planet ? { x: planet.x, y: planet.y } : null;
    }
    if (sel.kind === 'station') {
      const st = stationById(world, sel.id);
      return st ? { x: st.x, y: st.y } : null;
    }
    if (sel.kind === 'gate') {
      const gate = systemById(world, world.player.systemId)?.gates.find((g) => g.to === sel.to);
      return gate ? { x: gate.x, y: gate.y } : null;
    }
    const wreck = world.wrecks.find((w) => w.id === sel.id);
    return wreck ? { x: wreck.x, y: wreck.y } : null;
  }

  function doOrder(id: string): void {
    if (!world || !selected || !orderEnabled(id)) return;
    const point = focusPoint(selected);
    if (!point) return;
    audio.blip();
    const followId = followOf(selected);
    const weapon = playerFit(world.player).weapons.find((w) => w.online) ?? playerFit(world.player).weapons[0];
    const optimal = weapon?.optimal ?? 500;
    if (id === 'approach') queue({ t: 'dest', x: point.x, y: point.y, mode: 'approach', range: selected.kind === 'ship' ? 180 : 90, followId });
    if (id === 'orbit') queue({ t: 'dest', x: point.x, y: point.y, mode: 'orbit', range: clamp(optimal * 0.9, 200, 1600), followId });
    if (id === 'keep') queue({ t: 'dest', x: point.x, y: point.y, mode: 'keep', range: clamp(optimal * 1.25, 280, 2000), followId });
    if (id === 'hail') {
      hailLine = hailOf(world, selected);
      return;
    }
    if (id === 'lock' && selected.kind === 'ship') {
      queue({ t: 'select', id: selected.id });
      queue({ t: 'lock' });
    }
    if (id === 'dock') {
      const stationId = selected.kind === 'station' ? selected.id : world.stations.find((s) => s.planetId === (selected as { id: string }).id)?.id;
      if (stationId) queue({ t: 'dock', stationId });
    }
    if (id === 'jump' && selected.kind === 'gate') queue({ t: 'useGate', systemId: selected.to });
    radial = null;
  }

  function toggleModule(index: number): void {
    if (!world) return;
    const layout = slotLayout(hullOf(world.player.ship.hullId));
    if (layout[index] === 'rig' || !world.player.ship.modules[index]) return;
    queue({ t: 'toggleModule', index });
    audio.blip();
  }

  function hotkey(code: string): void {
    if (!world || mode === 'menu') return;
    const layout = slotLayout(hullOf(world.player.ship.hullId));
    if (code.startsWith('F')) {
      const n = Number(code.slice(1));
      if (n >= 1 && n <= 8) {
        let seen = 0;
        for (let i = 0; i < layout.length; i++) {
          if (layout[i] !== 'high') continue;
          seen += 1;
          if (seen === n) toggleModule(i);
        }
      }
      return;
    }
    if (/^Digit[1-8]$/.test(code)) {
      const n = Number(code.slice(5));
      let seen = 0;
      for (let i = 0; i < layout.length; i++) {
        if (layout[i] !== 'mid' && layout[i] !== 'low') continue;
        seen += 1;
        if (seen === n) toggleModule(i);
      }
    }
  }

  function cycleTarget(): void {
    if (!world || mode !== 'space') return;
    const here = world.player.systemId;
    const ships = world.pilots
      .filter((p) => !p.destroyed && !p.dockedAt && !p.jump && p.systemId === here)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!ships.length) return;
    const cur = ships.findIndex((p) => selected?.kind === 'ship' && p.id === selected.id);
    const next = ships[(cur + 1) % ships.length]!;
    applySelection({ kind: 'ship', id: next.id }, true);
  }

  function renderMenu(): void {
    if (menuView === 'main') menuEl.innerHTML = mainMenuHtml(!!world);
    else if (menuView === 'load') menuEl.innerHTML = loadHtml(world);
    else if (menuView === 'settings') menuEl.innerHTML = settingsHtml(audio.enabled, qualityName());
    else if (menuView === 'lore') menuEl.innerHTML = loreHtml();
    else menuEl.innerHTML = wizardHtml(menuView, draft);
    paintBadges(menuEl);
  }

  function paintBadges(host: ParentNode): void {
    host.querySelectorAll<HTMLCanvasElement>('canvas.emblem').forEach((canvas) => {
      const race = canvas.dataset.race;
      if (race === 'human' || race === 'kvissae' || race === 'zhargi' || race === 'taeyori' || race === 'virex') drawEmblem(canvas, race);
    });
    host.querySelectorAll<HTMLCanvasElement>('canvas.badge').forEach((canvas) => {
      const career = canvas.dataset.career;
      if (career === 'trader' || career === 'soldier' || career === 'hunter' || career === 'explorer' || career === 'pirate') drawCareerBadge(canvas, career);
    });
    host.querySelectorAll<HTMLCanvasElement>('canvas.gicon').forEach((canvas) => {
      if (canvas.dataset.good) drawGoodIcon(canvas, canvas.dataset.good);
    });
    host.querySelectorAll<HTMLCanvasElement>('canvas.micon').forEach((canvas) => {
      if (canvas.dataset.mod) drawModuleIcon(canvas, canvas.dataset.mod);
    });
  }

  function beginFromDraft(): void {
    const raw = draft.seed.trim();
    const seed = raw ? Number(raw) >>> 0 || 1 : Math.floor(Math.random() * 1_000_000_000);
    world = makeWorld(seed, draft.name.trim() || 'Илль Сед', {
      race: draft.race,
      career: draft.career,
      portrait: draft.portrait,
      settings: { size: draft.size, difficulty: draft.difficulty, invaders: draft.invaders, economy: draft.economy },
    });
    menuView = 'main';
    mode = 'space';
    pauseOpen = false;
    pilotOpen = false;
    selected = null;
    mapId = null;
    radial = null;
    picker = null;
    newer.clear();
    older.clear();
    snapshot();
    const st = stationById(world, world.player.dockedAt ?? '');
    if (st) {
      spaceCam.x = st.x;
      spaceCam.y = st.y;
      spaceCam.follow = true;
    }
    frameMap();
    void saveGame(world);
  }

  function frameMap(): void {
    if (!world) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const sys of world.systems) {
      minX = Math.min(minX, sys.x);
      maxX = Math.max(maxX, sys.x);
      minY = Math.min(minY, sys.y);
      maxY = Math.max(maxY, sys.y);
    }
    mapCam.x = (minX + maxX) / 2;
    mapCam.y = (minY + maxY) / 2;
    const spanX = maxX - minX + 400;
    const spanY = maxY - minY + 400;
    mapZoom = clamp(Math.min(viewW / spanX, viewH / (spanY * 0.82)) * 0.86, 0.08, 1.2);
    mapCam.zoom = mapZoom;
  }

  function zoomBy(factor: number): void {
    if (mode === 'map') mapZoom = clamp(mapZoom * factor, 0.08, 1.6);
    else spaceZoom = clamp(spaceZoom * factor, 0.08, 1.6);
  }

  function easeZoom(cam: Camera, target: number, dt: number): void {
    const prev = cam.zoom;
    const next = prev + (target - prev) * (1 - Math.exp(-7 * Math.max(dt, 0.016)));
    if (Math.abs(next - prev) < 0.0004) return;
    const mid = screenToWorld(cam, cam.viewW / 2, cam.viewH / 2);
    cam.zoom = next;
    const after = screenToWorld(cam, cam.viewW / 2, cam.viewH / 2);
    cam.x += mid.x - after.x;
    cam.y += mid.y - after.y;
  }

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target === canvas) return;
    const el = target.closest<HTMLElement>('[data-act]');
    if (!el) return;
    const act = el.dataset.act ?? '';
    if (act === 'new') {
      menuView = 'race';
      renderMenu();
      return;
    }
    if (act === 'back-menu' || act === 'wiz-back') {
      const order = ['race', 'career', 'face', 'galaxy', 'tale'] as const;
      const idx = order.indexOf(menuView as (typeof order)[number]);
      menuView = idx > 0 ? order[idx - 1]! : 'main';
      renderMenu();
      return;
    }
    if (act === 'pick-race') {
      draft.race = (el.dataset.race as PlayableRace) ?? draft.race;
      menuView = 'career';
      renderMenu();
      return;
    }
    if (act === 'pick-career') {
      draft.career = (el.dataset.career as CareerId) ?? draft.career;
      menuView = 'face';
      renderMenu();
      return;
    }
    if (act === 'roll-face' || act === 'face-next' || act === 'face-prev') {
      if (act === 'face-prev') draft.portrait = Math.max(1, draft.portrait - 1);
      else if (act === 'face-next') draft.portrait += 1;
      else draft.portrait = Math.floor(Math.random() * 9000) + 1;
      const cap = menuEl.querySelector('h2 + p.sub');
      if (cap) cap.textContent = `Шаг 3 из 4. Готовые лица народа. Вариант ${draft.portrait}.`;
      return;
    }
    if (act === 'quality') {
      const q = el.dataset.q;
      if (q === 'low' || q === 'medium' || q === 'high' || q === 'auto') setQuality(q);
      renderMenu();
      resize();
      return;
    }
    if (act === 'wiz-next') {
      draft.name = root.querySelector<HTMLInputElement>('#hero-name')?.value ?? draft.name;
      menuView = 'galaxy';
      renderMenu();
      return;
    }
    if (act === 'pick-set') {
      const seedBox = root.querySelector<HTMLInputElement>('#galaxy-seed');
      if (seedBox) draft.seed = seedBox.value;
      const key = el.dataset.key ?? '';
      const value = el.dataset.value ?? '';
      if (key === 'size') draft.size = value as GalaxySize;
      if (key === 'difficulty') draft.difficulty = value as Difficulty;
      if (key === 'invaders') draft.invaders = value as InvaderMood;
      if (key === 'economy') draft.economy = value as EconomyMood;
      renderMenu();
      return;
    }
    if (act === 'roll-seed') {
      draft.seed = String(Math.floor(Math.random() * 1_000_000_000));
      const input = root.querySelector<HTMLInputElement>('#galaxy-seed');
      if (input) input.value = draft.seed;
      return;
    }
    if (act === 'wiz-tale') {
      draft.seed = root.querySelector<HTMLInputElement>('#galaxy-seed')?.value ?? draft.seed;
      menuView = 'tale';
      renderMenu();
      return;
    }
    if (act === 'skip-splash') {
      mode = 'menu';
      audio.ambient();
      return;
    }
    if (act === 'launch') {
      beginFromDraft();
      return;
    }
    if (act === 'load') {
      menuView = 'load';
      renderMenu();
      return;
    }
    if (act === 'lore') {
      menuView = 'lore';
      renderMenu();
      return;
    }
    if (act === 'settings') {
      menuView = 'settings';
      renderMenu();
      return;
    }
    if (act === 'continue' && world) {
      mode = 'space';
      menuView = 'main';
      pauseOpen = false;
      spaceCam.x = world.player.x;
      spaceCam.y = world.player.y;
      spaceCam.follow = true;
      return;
    }
    if (act === 'pilot') {
      pilotOpen = true;
      return;
    }
    if (act === 'close-pilot') {
      pilotOpen = false;
      return;
    }
    if (act === 'train') {
      queue({ t: 'train', skill: (el.dataset.skill as 'aim') ?? 'aim' });
      return;
    }
    if (act === 'pause') {
      pauseOpen = true;
      helpOpen = false;
      return;
    }
    if (act === 'resume') {
      pauseOpen = false;
      helpOpen = false;
      return;
    }
    if (act === 'help') {
      helpOpen = true;
      return;
    }
    if (act === 'close-help') {
      helpOpen = false;
      localStorage.setItem('kromka-help-seen', '1');
      return;
    }
    if (act === 'to-menu') {
      pauseOpen = false;
      helpOpen = false;
      mode = 'menu';
      if (world) void saveGame(world);
      return;
    }
    if (act === 'export' && world) {
      exportGame(world);
      return;
    }
    if (act === 'sound') {
      audio.toggle();
      pauseStamp = '';
      if (menuView === 'settings') renderMenu();
      return;
    }
    if (act === 'map') {
      if (!world) return;
      mode = mode === 'map' ? 'space' : 'map';
      radial = null;
      picker = null;
      return;
    }
    if (act === 'stop') {
      queue({ t: 'stop' });
      return;
    }
    if (act === 'follow') {
      spaceCam.follow = true;
      return;
    }
    if (act === 'zin') {
      zoomBy(1.15);
      return;
    }
    if (act === 'zout') {
      zoomBy(1 / 1.15);
      return;
    }
    if (act === 'tab') {
      stationTab = (el.dataset.tab as typeof stationTab) ?? 'market';
      stationStamp = '';
      return;
    }
    if (act === 'slot') {
      fitSlot = Number(el.dataset.index);
      stationStamp = '';
      return;
    }
    if (act === 'undock') queue({ t: 'undock' });
    if (act === 'repair') queue({ t: 'repair' });
    if (act === 'buy') queue({ t: 'buy', goodId: el.dataset.good ?? '', qty: Number(el.dataset.qty) });
    if (act === 'sell') queue({ t: 'sell', goodId: el.dataset.good ?? '', qty: Number(el.dataset.qty) });
    if (act === 'buy-mod') queue({ t: 'buyMod', moduleId: el.dataset.mod ?? '' });
    if (act === 'sell-mod') queue({ t: 'sellMod', moduleId: el.dataset.mod ?? '' });
    if (act === 'fit') {
      queue({ t: 'buyMod', moduleId: el.dataset.mod ?? '' });
      queue({ t: 'fit', moduleId: el.dataset.mod ?? '', index: Number(el.dataset.index) });
    }
    if (act === 'fit-owned') queue({ t: 'fit', moduleId: el.dataset.mod ?? '', index: Number(el.dataset.index) });
    if (act === 'unfit') queue({ t: 'unfit', index: Number(el.dataset.index) });
    if (act === 'hull') queue({ t: 'buyHull', hullId: el.dataset.hull ?? '' });
    if (act === 'mission') queue({ t: 'acceptMission', id: el.dataset.id ?? '' });
    if (act === 'route' && mapId) {
      queue({ t: 'setRoute', systemId: mapId });
      mode = 'space';
      audio.jump();
    }
    if (act === 'clear-route') queue({ t: 'setRoute', systemId: null });
    if (act === 'ov') {
      const kind = el.dataset.kind;
      const id = el.dataset.id ?? '';
      if (mode === 'map') {
        mapId = id;
        return;
      }
      const item = pickables().find((p) => p.id === (kind === 'gate' ? `gate:${id}` : id));
      const sel: Sel | null =
        kind === 'ship' ? { kind: 'ship', id } :
        kind === 'planet' ? { kind: 'planet', id } :
        kind === 'station' ? { kind: 'station', id } :
        kind === 'wreck' ? { kind: 'wreck', id } :
        kind === 'gate' ? { kind: 'gate', to: id } : null;
      applySelection(sel, false);
      if (item && matchMedia('(pointer: fine)').matches) openRadialAt(item);
      return;
    }
    if (act === 'order') doOrder(el.dataset.order ?? '');
    if (act === 'mod') toggleModule(Number(el.dataset.index));
    if (act === 'pick') {
      const hit = picker?.hits[Number(el.dataset.i)];
      if (hit && picker) chooseHit(hit, picker.intent);
      return;
    }
    if (act === 'close-picker') picker = null;
    audio.blip();
  });

  root.querySelector('#menu')!.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.id === 'import-file' && input.files?.[0]) {
      void importGame(input.files[0]).then((loaded) => {
        world = loaded;
        mode = 'space';
        pauseOpen = false;
        snapshot();
      }).catch(() => {
        alert('Файл не похож на сохранение Кромки.');
      });
    }
  });

  window.addEventListener('keydown', (event) => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (event.code === 'Escape') {
      if (picker) picker = null;
      else if (radial) radial = null;
      else if (helpOpen) helpOpen = false;
      else if (mode !== 'menu') pauseOpen = !pauseOpen;
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyM' && world && mode !== 'menu') {
      mode = mode === 'map' ? 'space' : 'map';
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' && world && mode !== 'menu') {
      queue({ t: 'stop' });
      event.preventDefault();
      return;
    }
    if (event.code === 'Tab' && world) {
      cycleTarget();
      event.preventDefault();
      return;
    }
    if (event.code.startsWith('F') || event.code.startsWith('Digit')) {
      hotkey(event.code);
      if (event.code.startsWith('F')) event.preventDefault();
    }
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  canvas.addEventListener('pointerdown', (event) => {
    if (mode === 'splash') {
      mode = 'menu';
      audio.ambient();
      return;
    }
    if (event.target !== canvas) return;
    const p = canvasPoint(event);
    const canvasRect = { x: 0, y: 0, w: viewW, h: viewH };
    if (!worldPointerAllowed(p, canvasRect, blockerRects())) return;
    canvas.setPointerCapture(event.pointerId);
    const type: PointerKind = event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse';
    pointers.set(event.pointerId, { id: event.pointerId, type, x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), moved: 0 });
    if (pointers.size >= 2) {
      gestureLock = true;
      window.clearTimeout(longTimer);
      const pts = [...pointers.values()];
      pinchDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) || 1;
      pinchX = (pts[0]!.x + pts[1]!.x) / 2;
      pinchY = (pts[0]!.y + pts[1]!.y) / 2;
      return;
    }
    longFired = false;
    if (type !== 'mouse') {
      window.clearTimeout(longTimer);
      longTimer = window.setTimeout(() => {
        const ptr = pointers.get(event.pointerId);
        if (!ptr || ptr.moved > GESTURE.longPressSlopPx || pointers.size !== 1) return;
        onLong(ptr.x, ptr.y);
      }, GESTURE.longPressMs);
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    const ptr = pointers.get(event.pointerId);
    if (!ptr) return;
    const p = canvasPoint(event);
    const dx = p.x - ptr.x;
    const dy = p.y - ptr.y;
    ptr.x = p.x;
    ptr.y = p.y;
    ptr.moved = Math.hypot(p.x - ptr.sx, p.y - ptr.sy);
    if (ptr.moved > GESTURE.longPressSlopPx) window.clearTimeout(longTimer);
    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const distNow = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) || 1;
      const mx = (pts[0]!.x + pts[1]!.x) / 2;
      const my = (pts[0]!.y + pts[1]!.y) / 2;
      const cam = activeCam();
      const before = screenToWorld(cam, mx, my);
      cam.zoom = clamp(cam.zoom * (distNow / pinchDist), 0.08, 1.6);
      if (mode === 'map') mapZoom = cam.zoom;
      else spaceZoom = cam.zoom;
      const after = screenToWorld(cam, mx, my);
      cam.x += before.x - after.x - (mx - pinchX) / cam.zoom;
      cam.y += before.y - after.y - (my - pinchY) / (cam.zoom * 0.82);
      pinchDist = distNow;
      pinchX = mx;
      pinchY = my;
      if (mode === 'space') spaceCam.follow = false;
      return;
    }
    if (ptr.type === 'mouse' && ptr.moved > dragThreshold('mouse')) {
      const cam = activeCam();
      cam.x -= dx / cam.zoom;
      cam.y -= dy / (cam.zoom * 0.82);
      if (mode === 'space') spaceCam.follow = false;
    }
  });
  const endPointer = (event: PointerEvent) => {
    const ptr = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (!ptr) return;
    window.clearTimeout(longTimer);
    const wasLong = longFired;
    longFired = false;
    if (wasLong || gestureLock || pointers.size > 0) {
      if (pointers.size === 0) gestureLock = false;
      return;
    }
    const gesture = classifyGesture({
      pointerType: ptr.type,
      movedPx: ptr.moved,
      heldMs: performance.now() - ptr.t,
      released: true,
      pointers: 1,
    });
    if (gesture === 'tap') onWorldTap(ptr.x, ptr.y, ptr.type);
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? 0.9 : 1.1);
  }, { passive: false });

  document.addEventListener('visibilitychange', () => {
    hiddenPause = document.hidden;
    if (document.hidden && world) void saveGame(world);
  });
  window.addEventListener('resize', resize);
  window.addEventListener('beforeunload', () => {
    if (world && mode !== 'menu') {
      const text = JSON.stringify({ version: 1, savedAt: Date.now(), world });
      localStorage.setItem('kromka-save-v1', text);
    }
  });

  function paintChrome(): void {
    if (!world) return;
    const player = world.player;
    const sys = systemById(world, player.systemId);
    const loc = root.querySelector('#loc')!;
    const credits = root.querySelector('#credits')!;
    loc.textContent = player.jump ? `Прыжок · ${Math.round(player.jump.progress * 100)}%` : `${sys?.name ?? ''} · без.${sys?.security.toFixed(2) ?? ''}`;
    credits.textContent = `${Math.round(player.credits).toLocaleString('ru-RU')} кр.`;
    const fit = playerFit(player);
    const ratios = [player.ship.shield / fit.maxShield, player.ship.armor / fit.maxArmor, player.ship.hull / fit.maxHull, player.ship.cap / fit.maxCap];
    root.querySelectorAll('#bars .bar > i').forEach((node, i) => {
      (node as HTMLElement).style.width = `${Math.max(0, Math.min(1, ratios[i] ?? 0)) * 100}%`;
    });
    root.querySelector('#btn-map')!.textContent = mode === 'map' ? 'Система' : 'Карта';
    readout.innerHTML = readoutHtml(world);
  }

  function paintOverview(): void {
    if (!world || mode === 'menu') return;
    if (mode === 'map') {
      const rows = world.systems
        .map((sys) => ({ sys, d: Math.hypot(sys.x - (systemById(world!, world!.player.systemId)?.x ?? 0), sys.y - (systemById(world!, world!.player.systemId)?.y ?? 0)) }))
        .sort((a, b) => a.d - b.d || a.sys.id.localeCompare(b.sys.id));
      const stamp = rows.map((r) => r.sys.id + (r.sys.id === mapId ? '*' : '')).join();
      if (stamp === overviewStamp) return;
      overviewStamp = stamp;
      overview.innerHTML = `<h2>СИСТЕМЫ</h2>${rows.map(({ sys, d }) => `<button type="button" class="ov-item${sys.id === mapId ? ' on' : ''}" data-act="ov" data-kind="star" data-id="${esc(sys.id)}"><b>${esc(sys.name)}</b><small>${esc(FACTION_SHORT[sys.owner])} · без.${sys.security.toFixed(2)} · ${Math.round(d)} св.</small></button>`).join('')}`;
      return;
    }
    const items = localPickables().map((item) => ({ item, d: dist(world!.player.x, world!.player.y, item.x, item.y) })).sort((a, b) => a.d - b.d || a.item.id.localeCompare(b.item.id));
    const selKey = selected ? selectionKey(selected) : '';
    const stamp = items.map((row) => row.item.id).join('|') + selKey;
    if (stamp === overviewStamp) return;
    overviewStamp = stamp;
    overview.innerHTML = `<h2>ОБЗОР</h2>${items.map(({ item, d }) => {
      const id = item.kind === 'gate' ? item.id.slice(5) : item.id;
      const on = selectionKey(selected) === item.id || (selected?.kind === 'gate' && item.id === `gate:${selected.to}`);
      const orders = on ? `<div class="orders">${ORDERS.map((o) => `<button type="button" class="order" data-act="order" data-order="${o.id}" ${orderEnabled(o.id) ? '' : 'disabled'}>${o.label}</button>`).join('')}</div>` : '';
      return `<button type="button" class="ov-item${on ? ' on' : ''}" data-act="ov" data-kind="${item.kind}" data-id="${esc(id)}"><b>${esc(item.name)}</b><small>${kindName(item.kind)} · ${Math.round(d)} км</small></button>${orders}`;
    }).join('') || '<p class="sub">В системе пусто.</p>'}`;
  }

  function paintModules(): void {
    if (!world) return;
    const layout = slotLayout(hullOf(world.player.ship.hullId));
    const stamp = world.player.ship.modules.join(',') + world.player.ship.online.map((v) => (v ? '1' : '0')).join('');
    if (stamp === moduleStamp && modulesEl.childElementCount) {
      modulesEl.querySelectorAll<HTMLElement>('[data-cool]').forEach((node) => {
        const i = Number(node.dataset.cool);
        const cycle = MODULE_BY_ID[world!.player.ship.modules[i] ?? '']?.weapon?.cycle ?? MODULE_BY_ID[world!.player.ship.modules[i] ?? '']?.web?.cycle ?? 1;
        const left = world!.player.ship.cycles[i] ?? 0;
        node.style.width = `${Math.max(0, Math.min(1, left / cycle)) * 100}%`;
      });
      return;
    }
    moduleStamp = stamp;
    let high = 0;
    let midlow = 0;
    const buttons = layout.map((slot, index) => {
      if (slot === 'rig') return '';
      const id = world!.player.ship.modules[index];
      const def = id ? MODULE_BY_ID[id] : undefined;
      const key = slot === 'high' ? `F${++high}` : midlow < 8 ? String(++midlow) : '';
      if (slot !== 'high' && key === '') midlow += 0;
      return `<button type="button" class="mod${world!.player.ship.online[index] && id ? ' on' : ''}" data-act="mod" data-index="${index}" ${id ? '' : 'disabled'}><span class="key">${key ? `<kbd>${key}</kbd>` : slotLabel(slot, 0)}</span><span>${esc(def?.name ?? 'пусто')}</span><i data-cool="${index}" style="display:block;height:3px;background:var(--brass);width:0"></i></button>`;
    });
    const split = layout.findIndex((s) => s !== 'high');
    modulesEl.innerHTML = `<div class="mod-group">${buttons.slice(0, split).join('')}</div><div class="mod-group">${buttons.slice(split).join('')}</div>`;
  }

  function paintRadial(): void {
    if (!radial || !selected || paused() || mode !== 'space' || world?.player.dockedAt) {
      radialEl.hidden = true;
      radialStamp = '';
      return;
    }
    radialEl.hidden = false;
    radialEl.style.left = `${radial.x}px`;
    radialEl.style.top = `${radial.y}px`;
    const stamp = ORDERS.map((order) => order.id + (orderEnabled(order.id) ? '1' : '0')).join();
    if (stamp === radialStamp) return;
    radialStamp = stamp;
    radialEl.innerHTML = ORDERS.map((order, i) => {
      const ang = -Math.PI / 2 + (i / ORDERS.length) * Math.PI * 2;
      const x = Math.cos(ang) * 86;
      const y = Math.sin(ang) * 86;
      return `<button type="button" data-act="order" data-order="${order.id}" style="left:${x}px;top:${y}px" ${orderEnabled(order.id) ? '' : 'disabled'}>${order.label}</button>`;
    }).join('');
  }

  function paintPicker(): void {
    if (!picker) {
      pickerEl.hidden = true;
      pickerStamp = '';
      return;
    }
    pickerEl.hidden = false;
    pickerEl.style.left = `${picker.x}px`;
    pickerEl.style.top = `${picker.y}px`;
    const stamp = picker.hits.map((hit) => hit.item.id).join();
    if (stamp === pickerStamp && pickerEl.childElementCount) return;
    pickerStamp = stamp;
    pickerEl.innerHTML = `<p>Под пальцем несколько целей</p>${picker.hits.map((hit, i) => `<button type="button" data-act="pick" data-i="${i}">${esc(hit.item.name)} · ${kindName(hit.item.kind)}</button>`).join('')}<button type="button" data-act="close-picker">Закрыть</button>`;
  }

  function paintMapCard(): void {
    if (!world || mode !== 'map') {
      mapcard.hidden = true;
      return;
    }
    mapcard.hidden = false;
    const sys = mapId ? systemById(world, mapId) : systemById(world, world.player.systemId);
    if (!sys) {
      if (mapStamp !== 'empty') {
        mapcard.innerHTML = '<p>Выберите систему на карте или в списке справа.</p>';
        mapStamp = 'empty';
      }
      return;
    }
    const here = world.player.systemId === sys.id;
    const stamp = `${sys.id}|${here}|${sys.owner}|${world.player.route?.join(',') ?? ''}`;
    if (stamp === mapStamp) return;
    mapStamp = stamp;
    mapcard.innerHTML = `<strong>${esc(sys.name)}</strong><p class="sub">${esc(FACTION_NAME[sys.owner])} · безопасность ${sys.security.toFixed(2)}${sys.challenger ? ` · спор с ${esc(FACTION_SHORT[sys.challenger])}` : ''}</p><p>${here ? 'Вы здесь.' : `Прыжков по каналам: ${routeHops(world, sys.id)}`}</p><div class="stack"><button type="button" class="primary" data-act="route" ${here ? 'disabled' : ''}>Проложить маршрут</button><button type="button" data-act="clear-route">Снять маршрут</button></div>`;
  }

  function paintStation(): void {
    if (!world) return;
    const docked = world.player.dockedAt && mode === 'space';
    stationEl.hidden = !docked;
    if (!docked) return;
    const st = stationById(world, world.player.dockedAt!)!;
    const stamp = `${stationTab}|${st.id}|${fitSlot}|${world.player.ship.hullId}|${world.player.ship.modules.join(',')}|${world.missions.map((m) => m.id + m.status).join()}|${Object.keys(world.player.locker).sort().join()}`;
    if (stamp !== stationStamp) {
      stationStamp = stamp;
      const keep = stationEl.scrollTop;
      stationEl.innerHTML = stationHtml(world, st.id, stationTab, fitSlot);
      stationEl.scrollTop = keep;
      paintBadges(stationEl);
    }
    const sys = systemById(world, st.systemId);
    for (const good of GOODS) {
      const node = stationEl.querySelector<HTMLElement>(`[data-price="${good.id}"]`);
      if (!node) continue;
      const price = stationPrice(st, good.id, world.events, !!sys?.challenger, economyVolatility(world.settings?.economy));
      node.textContent = `${price.toLocaleString('ru-RU')} кр. · запас ${Math.floor(st.market[good.id]?.stock ?? 0)} · у вас ${world.player.cargo[good.id] ?? 0}`;
    }
  }

  function paintMenus(): void {
    const playing = mode === 'space' || mode === 'map';
    menuEl.hidden = mode !== 'menu';
    hud.hidden = !playing;
    const skip = root.querySelector<HTMLElement>('#splash-skip');
    if (skip) skip.hidden = mode !== 'splash';
    pauseEl.hidden = !pauseOpen;
    helpEl.hidden = !helpOpen;
    pilotEl.hidden = !pilotOpen || mode === 'menu';
    if (pilotOpen && world && mode !== 'menu') {
      const stamp = `${Math.floor(world.player.xp)}|${world.player.spent}|${Object.values(world.player.skills).join(',')}|${Object.entries(world.player.proficiency).map(([k, v]) => k + Math.floor(v)).join()}`;
      if (stamp !== pilotEl.dataset.stamp) {
        pilotEl.dataset.stamp = stamp;
        pilotEl.innerHTML = pilotHtml(world.player);
      }
    } else pilotEl.dataset.stamp = '';
    if (pauseOpen && pauseStamp === '') {
      pauseStamp = 'open';
      pauseEl.innerHTML = `<div class="pause-card"><h2>Пауза</h2><p class="sub">Мир остановлен. В бою отдельной паузы нет — только это меню и скрытая вкладка.</p><div class="stack"><button type="button" class="primary" data-act="resume">Продолжить</button><button type="button" data-act="help">Управление</button><button type="button" data-act="export">Экспорт сохранения</button><button type="button" data-act="sound">Звук: ${audio.enabled ? 'вкл' : 'выкл'}</button><button type="button" data-act="to-menu">В главное меню</button><p class="sub">${world ? `Зерно ${world.seed} · ${clock(world.time)}` : ''}</p></div></div>`;
    }
    if (!pauseOpen) pauseStamp = '';
  }

  function frame(t: number): void {
    const now = t / 1000;
    const dt = lastT ? Math.min(0.25, now - lastT) : 0;
    lastT = now;
    if (world && !paused()) {
      acc += dt;
      let steps = 0;
      while (acc >= SIM_DT && steps < 6) {
        const batch = steps === 0 ? commands : [];
        step(world, batch);
        if (steps === 0) commands = [];
        snapshot();
        acc -= SIM_DT;
        steps += 1;
      }
      if (steps === 0) alpha = acc / SIM_DT;
      else alpha = acc / SIM_DT;
      saveTimer += dt;
      if (saveTimer > 15) {
        saveTimer = 0;
        void saveGame(world);
      }
    } else acc = 0;
    resize();
    if (mode === 'map') easeZoom(mapCam, mapZoom, dt);
    else easeZoom(spaceCam, spaceZoom, dt);
    if (world && spaceCam.follow && mode === 'space') {
      const at = sample('player', world.player.x, world.player.y);
      const k = 1 - Math.exp(-4 * Math.max(dt, 0.016));
      spaceCam.x += (at.x - spaceCam.x) * k;
      spaceCam.y += (at.y - spaceCam.y) * k;
    }
    const cam = activeCam();
    if (mode === 'splash') {
      if (!splashAt) splashAt = now;
      drawSplash(ctx, viewW, viewH, now - splashAt);
      if (now - splashAt > 5.6) {
        mode = 'menu';
        audio.ambient();
      }
    } else if (!world || mode === 'menu') drawMenu(ctx, viewW, viewH, now);
    else if (mode === 'map') drawMap(ctx, world, cam, mapId ?? world.player.systemId, now);
    else drawSystem(ctx, world, cam, selected ? (selected.kind === 'gate' ? `gate:${selected.to}` : selected.id) : null, pilotSamples(world, sample), now);
    paintMenus();
    const portraitHost = pilotOpen && mode !== 'menu' ? pilotEl : menuEl;
    const portrait = portraitHost.querySelector<HTMLCanvasElement>('#portrait');
    const hangar = stationEl.querySelector<HTMLCanvasElement>('#hangar');
    if (hangar && world?.player.dockedAt && mode === 'space') {
      const dockId = world.player.dockedAt;
      const owner = world.stations.find((s) => s.id === dockId)?.owner ?? 'free';
      const hctx = hangar.getContext('2d');
      if (hctx) drawHangar(hctx, hangar.width, hangar.height, owner, now, world.player.ship.hullId);
    }
    if (portrait) {
      const race = pilotOpen && world?.player.origin ? world.player.origin.race : draft.race;
      const face = pilotOpen && world?.player.origin ? world.player.origin.portrait : draft.portrait;
      drawPortrait(portrait, race, face, now);
    }
    root.querySelectorAll<HTMLCanvasElement>('canvas.gicon').forEach((node) => {
      if (node.dataset.good) drawGoodIcon(node, node.dataset.good);
    });
    root.querySelectorAll<HTMLCanvasElement>('canvas.micon').forEach((node) => {
      if (node.dataset.mod) drawModuleIcon(node, node.dataset.mod);
    });
    root.querySelectorAll<HTMLCanvasElement>('canvas.face').forEach((node) => {
      const race = node.dataset.race;
      if (race === 'human' || race === 'zhargi' || race === 'kvissae' || race === 'taeyori' || race === 'virex') {
        drawPortrait(node, race, Number(node.dataset.face ?? 1), now);
      }
    });
    const comms = root.querySelector<HTMLCanvasElement>('#comms');
    const hailed = selected;
    if (comms && world && mode === 'space' && hailed?.kind === 'ship' && hailed.id !== 'player') {
      const pilot = world.pilots.find((p) => p.id === hailed.id);
      const race = pilot?.faction;
      const known = race === 'human' || race === 'zhargi' || race === 'kvissae' || race === 'taeyori' || race === 'virex' || race === 'omnir';
      comms.hidden = !known;
      if (known && race) drawPortrait(comms, race, hashFace(hailed.id), now);
    } else if (comms) comms.hidden = true;
    if (world && mode !== 'menu') {
      paintChrome();
      paintOverview();
      paintModules();
      paintStation();
      paintMapCard();
      paintRadial();
      paintPicker();
      if (selected?.kind === 'wreck' && world.time - lootAt > 0.6) {
        const wreckId = selected.id;
        const wreck = world.wrecks.find((w) => w.id === wreckId);
        if (wreck && dist(world.player.x, world.player.y, wreck.x, wreck.y) < 170) {
          lootAt = world.time;
          queue({ t: 'loot', wreckId });
        }
      }
      const pings = world.pings.length;
      if (pings !== knownPing) {
        const last = world.pings[world.pings.length - 1];
        if (last?.kind === 'explode') audio.explode();
        else if (last?.kind === 'hit') audio.laser();
        knownPing = pings;
      }
    }
    requestAnimationFrame(frame);
  }

  resize();
  helpEl.innerHTML = helpHtml();
  renderMenu();
  void loadGame().then((loaded) => {
    if (loaded) {
      world = loaded;
      snapshot();
      frameMap();
      if (menuView === 'main' || menuView === 'load') renderMenu();
    }
  });
  requestAnimationFrame(frame);
}

function selectionKey(sel: Sel | null): string {
  if (!sel) return '';
  if (sel.kind === 'gate') return `gate:${sel.to}`;
  return sel.id;
}

function kindName(kind: string): string {
  switch (kind) {
    case 'ship':
      return 'корабль';
    case 'planet':
      return 'планета';
    case 'station':
      return 'док';
    case 'gate':
      return 'врата';
    case 'wreck':
      return 'обломки';
    default:
      return 'система';
  }
}

function readoutHtml(world: World): string {
  const player = world.player;
  const fit = playerFit(player);
  const speed = Math.round(Math.hypot(player.vx, player.vy));
  const mission = world.missions.find((m) => m.status === 'active');
  const lock = player.lock ? `Захват ${Math.round((player.lock.t / player.lock.need) * 100)}%` : player.locked.length ? `Целей: ${player.locked.length}` : 'Нет захвата';
  const lines = world.logs.slice(-2).map((l) => esc(l.text.length > 88 ? `${l.text.slice(0, 88)}…` : l.text)).join('<br>');
  return `<div>${speed} км/с · ${lock}${player.combatTimer > 0 ? ' · в бою' : ''}${player.route ? ' · маршрут' : ''}</div><div class="log">${hailLine ? esc(hailLine) : mission ? esc(mission.title) : 'Нет активного контракта'}</div><div class="log">${lines}</div><div class="log">Урон ${Math.round(fit.dps)} · ${fit.weapons.map((w) => DTYPE_NAME[w.type]).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'без орудий'}</div>`;
}

function routeHops(world: World, to: string): string {
  const path = findPath(world, world.player.systemId, to);
  if (!path) return 'нет';
  return String(Math.max(0, path.length - 1));
}

function stationHtml(world: World, stationId: string, tab: string, fitSlot: number | null): string {
  const st = stationById(world, stationId)!;
  const tech = stationTech(world, st);
  const tabs = [
    ['market', 'Рынок'],
    ['fit', 'Верфь'],
    ['jobs', 'Контракты'],
    ['repair', 'Ремонт'],
  ].map(([id, label]) => `<button type="button" data-act="tab" data-tab="${id}" class="${tab === id ? 'on' : ''}">${label}</button>`).join('');
  let body = '';
  if (tab === 'market') {
    body = GOODS.map((good) => `<div class="good"><canvas class="gicon" data-good="${good.id}" width="32" height="32"></canvas><div><b>${esc(good.name)}</b><div class="sub" data-price="${good.id}"></div></div><div class="btns"><button type="button" data-act="buy" data-good="${good.id}" data-qty="1">+1</button><button type="button" data-act="buy" data-good="${good.id}" data-qty="10">+10</button><button type="button" data-act="sell" data-good="${good.id}" data-qty="1">−1</button><button type="button" data-act="sell" data-good="${good.id}" data-qty="10">−10</button><button type="button" data-act="sell" data-good="${good.id}" data-qty="999">Слить</button></div></div>`).join('');
  } else if (tab === 'fit') {
    const hull = hullOf(world.player.ship.hullId);
    const layout = slotLayout(hull);
    const fit = playerFit(world.player);
    const slots = layout.map((slot, index) => {
      const id = world.player.ship.modules[index];
      const def = id ? MODULE_BY_ID[id] : undefined;
      return `<div class="slot"><canvas class="micon" data-mod="${id ?? ''}" width="32" height="32"></canvas><button type="button" data-act="slot" data-index="${index}">${slotLabel(slot, layout.slice(0, index).filter((s) => s === slot).length)}: ${esc(def?.name ?? 'пусто')}</button>${id ? `<button type="button" data-act="unfit" data-index="${index}">Снять</button>` : ''}</div>`;
    }).join('');
    const catalog = fitSlot == null ? '' : catalogHtml(world, st.owner, tech, layout[fitSlot]!, fitSlot);
    const hulls = HULLS.filter((h) => h.tech <= tech).map((h) => `<button type="button" data-act="hull" data-hull="${h.id}" ${h.id === hull.id ? 'disabled' : ''}>${esc(h.name)} · ${h.price.toLocaleString('ru-RU')}</button>`).join(' ');
    body = `<div class="stats"><span>Сеть ${Math.round(fit.pgUsed)}/${Math.round(fit.pg)}</span><span>Процессор ${Math.round(fit.cpuUsed)}/${Math.round(fit.cpu)}</span><span>Калибровка ${Math.round(fit.calUsed)}/${Math.round(fit.cal)}</span><span>Скорость ${Math.round(fit.speed)} км/с</span><span>Трюм ${Math.round(cargoUsed(world.player.cargo))}/${Math.round(fit.cargo)}</span><span>Урон ${Math.round(fit.dps)}</span><span>Щит ${Math.round(fit.maxShield)}</span><span>Броня ${Math.round(fit.maxArmor)}</span></div>${slots}${catalog}<h3>Корпуса верфи (тех. ${tech})</h3><div class="btns">${hulls}</div>`;
  } else if (tab === 'jobs') {
    const list = world.missions.filter((m) => m.stationId === stationId || m.status === 'active');
    body = list.map((m) => `<article class="job"><div><b>${esc(m.title)}</b><div class="sub">${esc(m.desc)}</div><div class="sub">Награда ${Math.round(m.reward).toLocaleString('ru-RU')} · ${m.status === 'active' ? 'активен' : 'предложение'}</div></div>${m.status === 'offer' ? `<button type="button" class="primary" data-act="mission" data-id="${esc(m.id)}">Принять</button>` : ''}</article>`).join('') || '<p>Доска пуста.</p>';
    const rumors = world.rumors.slice(-4).map((r) => `<p class="sub">${esc(r.text)}</p>`).join('');
    body += `<h3>Слухи</h3>${rumors || '<p class="sub">Тихо.</p>'}`;
  } else {
    const fit = playerFit(world.player);
    const cost = Math.ceil(Math.max(0, fit.maxShield - world.player.ship.shield) * 1.2 + Math.max(0, fit.maxArmor - world.player.ship.armor) * 2.5 + Math.max(0, fit.maxHull - world.player.ship.hull) * 7);
    const reps = (Object.keys(FACTION_SHORT) as (keyof typeof FACTION_SHORT)[]).map((id) => `${FACTION_SHORT[id]} ${Math.round(world.player.reputation[id])}`).join(' · ');
    body = `<p>Щит ${Math.round(world.player.ship.shield)} / ${Math.round(fit.maxShield)}</p><p>Броня ${Math.round(world.player.ship.armor)} / ${Math.round(fit.maxArmor)}</p><p>Корпус ${Math.round(world.player.ship.hull)} / ${Math.round(fit.maxHull)}</p><button type="button" class="primary" data-act="repair" ${cost <= 0 ? 'disabled' : ''}>Чинить за ${cost.toLocaleString('ru-RU')}</button><h3>Репутация</h3><p>${reps}</p><p class="sub">Побед: ${world.player.kills}. Склад модулей летит с кораблём.</p>`;
  }
    return `<canvas id="hangar" width="720" height="160"></canvas><div class="tabs">${tabs}<button type="button" class="primary" data-act="undock">В космос</button></div><p class="sub">${esc(st.name)} · ${esc(FACTION_NAME[st.owner])}</p>${body}`;
}

function catalogHtml(world: World, owner: World['stations'][number]['owner'], tech: number, slot: string, index: number): string {
  const mods = MODULES.filter((m) => m.slot === slot && m.tech <= tech);
  const owned = Object.entries(world.player.locker).filter(([id, n]) => n > 0 && MODULE_BY_ID[id]?.slot === slot);
  const own = owned.map(([id, n]) => `<button type="button" data-act="fit-owned" data-mod="${id}" data-index="${index}">Со склада: ${esc(MODULE_BY_ID[id]!.name)} ×${n}</button>`).join(' ');
  const shop = mods.map((m) => `<button type="button" data-act="fit" data-mod="${m.id}" data-index="${index}">${esc(m.name)} · ${m.price.toLocaleString('ru-RU')} · ${m.pg} сети / ${m.cpu} цп</button>`).join(' ');
  return `<h3>Слот</h3><p class="sub">${mods[0] ? esc(mods[0].blurb) : ''}</p><div class="stack">${own}${shop}<button type="button" data-act="sell-mod" data-mod="${owned[0]?.[0] ?? ''}" ${owned.length ? '' : 'disabled'}>Продать один со склада</button></div><p class="sub">Скидка растёт с репутацией у ${esc(FACTION_SHORT[owner])}.</p>`;
}

function hashFace(id: string): number {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 33 + id.charCodeAt(i)) >>> 0;
  return n;
}

function hailOf(world: World, sel: Sel): string {
  if (sel.kind === 'station') {
    const st = stationById(world, sel.id);
    return st ? hailVoice(st.owner, 'defender', st.name, true) : 'Канал пуст.';
  }
  if (sel.kind !== 'ship') return 'Канал молчит.';
  const pilot = world.pilots.find((p) => p.id === sel.id);
  if (!pilot) return 'Нет ответа.';
  return hailVoice(pilot.faction, pilot.role, pilot.name, false);
}

function playerFit(player: Player) {
  return computeFit(player.ship, { bonus: player.skills ? skillBonus(player.skills, player.origin?.race ?? 'kvissae') : undefined });
}

function helpHtml(): string {
  return `<div class="help-grid"><div><h3>Мышь и клавиатура</h3><ul><li>Пустой космос — лететь в точку. Объект — выбрать и открыть кольцо: приблизиться, орбита, дистанция, захват, связь, стыковка, прыжок.</li><li>Если под курсором несколько целей, появляется список. Игра не выбирает за вас.</li><li>Колесо — масштаб, перетаскивание — сдвинуть камеру. «Следить» возвращает её к кораблю.</li><li><kbd>F1</kbd>–<kbd>F8</kbd> верхние слоты, <kbd>1</kbd>–<kbd>8</kbd> средние и нижние.</li><li><kbd>Tab</kbd> следующая цель, <kbd>Пробел</kbd> стоп, <kbd>M</kbd> карта, <kbd>Esc</kbd> меню.</li></ul></div><div><h3>Палец</h3><ul><li>Касание пустоты — лететь, касание объекта — выбрать. Удержание открывает кольцо приказов.</li><li>Зона касания не меньше 44 пикселей, даже если корабль на экране крошечный.</li><li>Щипок меняет масштаб, два пальца двигают камеру. Один палец карту не тащит.</li><li>Справа список «Обзор»: любую цель можно выбрать оттуда, без точного тыка.</li><li>Кнопки модулей снизу крупные. Панели не пропускают нажатия в космос.</li></ul></div></div><h3>Петля</h3><p>Стыкуйтесь, торгуйте, собирайте корпус в верфи. Кнопка «Пилот» — навыки, освоение корпусов и орудий, звания рас. Карьера со старта не запирает другие ветки. Щит лучше держит кинетику и взрыв, броня — ЭМ и термал. Пауза только в меню и когда вкладка скрыта.</p><button type="button" class="primary" data-act="close-help">В полёт</button>`;
}

function clock(time: number): string {
  const s = Math.floor(time);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}
