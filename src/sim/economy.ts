import { GOOD_BY_ID, GOOD_IDS } from './content';
import { clamp } from './rng';
import type { FactionId, GameEvent, MarketLot, PlanetType, Station } from './types';

const PROFILE: Record<PlanetType, { out: Record<string, number>; inn: Record<string, number> }> = {
  volcanic: { out: { ore: 0.55, iso: 0.22, alloy: 0.16 }, inn: { food: 0.36, water: 0.3, meds: 0.12, cells: 0.08 } },
  ocean: { out: { water: 0.72, food: 0.48, pearl: 0.14 }, inn: { ore: 0.22, plates: 0.16, fuel: 0.18 } },
  barren: { out: { ore: 0.42, alloy: 0.12 }, inn: { food: 0.4, water: 0.36, fuel: 0.16 } },
  ice: { out: { water: 0.58, iso: 0.36, fuel: 0.16 }, inn: { food: 0.3, meds: 0.12, drones: 0.1 } },
  gas: { out: { fuel: 0.64, iso: 0.2 }, inn: { food: 0.26, plates: 0.2, drones: 0.16 } },
  garden: { out: { food: 0.74, meds: 0.28, pearl: 0.2, water: 0.22 }, inn: { alloy: 0.2, plates: 0.14, fuel: 0.16 } },
  hive: { out: { drones: 0.48, plates: 0.38, cells: 0.3, alloy: 0.22 }, inn: { ore: 0.48, food: 0.42, fuel: 0.26, water: 0.2 } },
};

const RACE_OUT: Partial<Record<FactionId, Record<string, number>>> = {
  human: { food: 1.2, plates: 1.15 },
  zhargi: { ore: 1.85, alloy: 1.75, cells: 1.25 },
  kvissae: { pearl: 1.5, food: 1.2, data: 1.25 },
  taeyori: { data: 1.8, meds: 1.35, iso: 1.25 },
  virex: { drones: 1.65, plates: 1.5, alloy: 1.15 },
};

export function makeMarket(
  rng: () => number,
  type: PlanetType,
  faction: FactionId,
  security: number,
): Record<string, MarketLot> {
  const profile = PROFILE[type];
  const race = RACE_OUT[faction] ?? {};
  const market: Record<string, MarketLot> = {};
  for (const id of GOOD_IDS) {
    const base = GOOD_BY_ID[id]?.base ?? 100;
    let out = profile.out[id] ?? 0;
    let inn = profile.inn[id] ?? 0;
    if (race[id]) out *= race[id];
    if (faction === 'omnir') {
      out *= 0.12;
      inn *= 1.35;
    }
    if (id === 'data' && (faction === 'taeyori' || security > 0.7)) out += 0.18;
    if ((id === 'ore' || id === 'alloy') && faction === 'zhargi') out += 0.2;
    if (id === 'cells' && security < 0.35) inn += 0.12;
    const weight = out + inn;
    const capacity = Math.round(220 + weight * 520 + (out > inn ? 80 : 0));
    const comfort = out >= inn ? 0.45 + rng() * 0.35 : 0.18 + rng() * 0.22;
    market[id] = {
      stock: Math.round(capacity * comfort),
      capacity,
      base,
      produce: out * 0.34,
      consume: inn * 0.27,
    };
  }
  return market;
}

export function priceMult(stock: number, capacity: number, volatility = 1): number {
  const ratio = stock / Math.max(40, capacity);
  const mult = Math.pow(0.7 / Math.max(0.08, ratio), 0.62);
  const swung = 1 + (mult - 1) * volatility;
  return clamp(swung, 0.3, 3.5);
}

export function eventPriceMult(events: GameEvent[], systemId: string, goodId: string): number {
  let m = 1;
  for (const e of events) {
    if (e.systemId !== systemId) continue;
    if (e.kind === 'epidemic') {
      if (goodId === 'meds') m *= 1.65;
      else if (goodId === 'food') m *= 1.25;
    } else if (e.kind === 'shortage' && e.goodId === goodId) m *= 1.85;
    else if (e.kind === 'boom' && (goodId === 'pearl' || goodId === 'plates' || goodId === 'alloy')) m *= 0.82;
    else if (e.kind === 'crisis') m *= 1.12;
    else if (e.kind === 'incursion' && (goodId === 'cells' || goodId === 'fuel')) m *= 1.35;
  }
  return m;
}

export function quote(lot: MarketLot, extra = 1, volatility = 1): number {
  return Math.max(1, Math.round(lot.base * priceMult(lot.stock, lot.capacity, volatility) * extra));
}

export function priceExtra(events: GameEvent[], systemId: string, goodId: string, warHere: boolean): number {
  let extra = eventPriceMult(events, systemId, goodId);
  if (warHere && (goodId === 'cells' || goodId === 'fuel' || goodId === 'meds')) extra *= 1.22;
  return extra;
}

export function stationPrice(station: Station, goodId: string, events: GameEvent[], warHere: boolean, volatility = 1): number {
  const lot = station.market[goodId];
  if (!lot) return GOOD_BY_ID[goodId]?.base ?? 1;
  return quote(lot, priceExtra(events, station.systemId, goodId, warHere), volatility);
}

export function buyGoods(
  station: Station,
  goodId: string,
  qty: number,
  events: GameEvent[],
  warHere: boolean,
  budget = Number.POSITIVE_INFINITY,
  volatility = 1,
): { qty: number; credits: number } {
  const lot = station.market[goodId];
  if (!lot) return { qty: 0, credits: 0 };
  const extra = priceExtra(events, station.systemId, goodId, warHere);
  const n = Math.max(0, Math.floor(qty));
  let credits = 0;
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (lot.stock < 1) break;
    const price = quote(lot, extra, volatility);
    if (credits + price > budget) break;
    lot.stock -= 1;
    credits += price;
    got += 1;
  }
  return { qty: got, credits };
}

export function sellGoods(
  station: Station,
  goodId: string,
  qty: number,
  events: GameEvent[],
  warHere: boolean,
  volatility = 1,
): { qty: number; credits: number } {
  const lot = station.market[goodId];
  if (!lot) return { qty: 0, credits: 0 };
  return walkSell(lot, qty, priceExtra(events, station.systemId, goodId, warHere), volatility);
}

export function roughCargoValue(cargo: Record<string, number>): number {
  let s = 0;
  for (const id of Object.keys(cargo)) s += (GOOD_BY_ID[id]?.base ?? 30) * (cargo[id] ?? 0);
  return s;
}

/** Walk the book one unit at a time so a dump moves the price. Returns credits moved. */
export function walkBuy(lot: MarketLot, qty: number, extra = 1): { qty: number; credits: number } {
  const n = Math.max(0, Math.floor(qty));
  let credits = 0;
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (lot.stock < 1) break;
    credits += quote(lot, extra);
    lot.stock -= 1;
    got += 1;
  }
  return { qty: got, credits };
}

export function walkSell(lot: MarketLot, qty: number, extra = 1, volatility = 1): { qty: number; credits: number } {
  const n = Math.max(0, Math.floor(qty));
  let credits = 0;
  for (let i = 0; i < n; i++) {
    credits += quote(lot, extra, volatility);
    lot.stock += 1;
  }
  return { qty: n, credits };
}

export function tickMarket(station: Station, events: GameEvent[], dt: number): void {
  let prodMod = 1;
  let consMod = 1;
  for (const e of events) {
    if (e.systemId !== station.systemId) continue;
    if (e.kind === 'epidemic') prodMod *= 0.72;
    if (e.kind === 'crisis') prodMod *= 0.78;
    if (e.kind === 'boom') prodMod *= 1.25;
    if (e.kind === 'incursion') prodMod *= 0.55;
    if (e.kind === 'epidemic') consMod *= 1.15;
  }
  for (const id of GOOD_IDS) {
    const lot = station.market[id];
    if (!lot) continue;
    let cons = lot.consume * consMod;
    if (events.some((e) => e.systemId === station.systemId && e.kind === 'epidemic' && id === 'meds')) cons *= 1.8;
    if (events.some((e) => e.systemId === station.systemId && e.kind === 'shortage' && e.goodId === id)) cons *= 1.45;
    lot.stock = clamp(lot.stock + (lot.produce * prodMod - cons) * dt, 0, lot.capacity * 3);
  }
}

export function flowOf(lot: MarketLot): number {
  return lot.produce - lot.consume;
}
