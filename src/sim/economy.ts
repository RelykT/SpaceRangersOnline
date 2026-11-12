import { GOOD_BY_ID, GOOD_IDS } from './content';
import { clamp } from './rng';
import type { FactionId, GameEvent, MarketLot, PlanetType, Station } from './types';

const PROFILE: Record<PlanetType, { out: Record<string, number>; inn: Record<string, number> }> = {
  volcanic: { out: { fe: 0.55, ti: 0.34, ni: 0.28, w: 0.18 }, inn: { he3: 0.22, crystals: 0.12, rare: 0.1 } },
  ocean: { out: { al: 0.42, cu: 0.3 }, inn: { fe: 0.22, ti: 0.16, he3: 0.18 } },
  barren: { out: { fe: 0.42, al: 0.2, ni: 0.16 }, inn: { he3: 0.24, deuterium: 0.16, rare: 0.1 } },
  ice: { out: { deuterium: 0.48, he3: 0.3 }, inn: { fe: 0.2, cu: 0.14, crystals: 0.1 } },
  gas: { out: { he3: 0.64, deuterium: 0.36 }, inn: { ti: 0.18, al: 0.14, rare: 0.12 } },
  garden: { out: { al: 0.4, cu: 0.28, rare: 0.16 }, inn: { fe: 0.2, w: 0.12, he3: 0.16 } },
  hive: { out: { cu: 0.46, al: 0.32, pt: 0.22, rare: 0.2 }, inn: { fe: 0.48, ti: 0.24, biomass: 0.16, he3: 0.2 } },
};

const RACE_OUT: Partial<Record<FactionId, Record<string, number>>> = {
  human: { fe: 1.25, al: 1.2, cu: 1.15 },
  zhargi: { fe: 1.9, ni: 1.8, ti: 1.55, w: 1.45 },
  kvissae: { pt: 1.45, cu: 1.3, al: 1.25 },
  taeyori: { crystals: 1.9, rare: 1.35 },
  virex: { rare: 1.6, pt: 1.35, cu: 1.25 },
  omnir: { biomass: 1.8 },
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
    if (id === 'crystals' && (faction === 'taeyori' || security > 0.7)) out += 0.16;
    if ((id === 'fe' || id === 'ni' || id === 'ti' || id === 'w') && faction === 'zhargi') out += 0.22;
    if (id === 'w' && security < 0.35) inn += 0.12;
    if (id === 'biomass' && faction === 'omnir') out += 0.45;
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
      if (goodId === 'crystals') m *= 1.55;
      else if (goodId === 'biomass') m *= 1.4;
    } else if (e.kind === 'shortage' && e.goodId === goodId) m *= 1.85;
    else if (e.kind === 'boom' && (goodId === 'pt' || goodId === 'rare' || goodId === 'al')) m *= 0.82;
    else if (e.kind === 'crisis') m *= 1.12;
    else if (e.kind === 'incursion' && (goodId === 'he3' || goodId === 'deuterium' || goodId === 'w')) m *= 1.35;
  }
  return m;
}

export function quote(lot: MarketLot, extra = 1, volatility = 1): number {
  return Math.max(1, Math.round(lot.base * priceMult(lot.stock, lot.capacity, volatility) * extra));
}

export function priceExtra(events: GameEvent[], systemId: string, goodId: string, warHere: boolean): number {
  let extra = eventPriceMult(events, systemId, goodId);
  if (warHere && (goodId === 'he3' || goodId === 'w' || goodId === 'crystals')) extra *= 1.22;
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
    if (events.some((e) => e.systemId === station.systemId && e.kind === 'epidemic' && (id === 'crystals' || id === 'biomass'))) cons *= 1.7;
    if (events.some((e) => e.systemId === station.systemId && e.kind === 'shortage' && e.goodId === id)) cons *= 1.45;
    lot.stock = clamp(lot.stock + (lot.produce * prodMod - cons) * dt, 0, lot.capacity * 3);
  }
}

export function flowOf(lot: MarketLot): number {
  return lot.produce - lot.consume;
}
