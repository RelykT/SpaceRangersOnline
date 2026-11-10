import { FACTION_ENGINE } from '../sim/content';
import { getQuality } from './quality';

const cache = new Map<string, HTMLCanvasElement>();

export function shipCanvas(hullId: string, color: string, angle: number, faction: string): HTMLCanvasElement {
  const q = getQuality();
  const steps = q.shipAngles;
  const bucket = Math.round(((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * steps) % steps;
  const key = `${q.name}|${hullId}|${faction}|${color}|${bucket}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const px = q.shipPx;
  const c = document.createElement('canvas');
  c.width = px * 2;
  c.height = px * 2;
  const ctx = c.getContext('2d')!;
  const ang = (bucket / steps) * Math.PI * 2;
  ctx.translate(px, px);
  ctx.rotate(ang);
  traceHull(ctx, hullId, faction, px * 0.72);
  ctx.fillStyle = '#140c08';
  ctx.save();
  ctx.translate(2, 3);
  ctx.fill();
  ctx.restore();
  const lit = ctx.createLinearGradient(0, -px, 0, px);
  lit.addColorStop(0, '#ffffff');
  lit.addColorStop(0.28, color);
  lit.addColorStop(0.72, shade(color, -35));
  lit.addColorStop(1, '#12080a');
  ctx.fillStyle = lit;
  ctx.fill();
  ctx.lineWidth = Math.max(1, px * 0.035);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-px * 0.15, 0);
  ctx.lineTo(px * 0.35, 0);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  if (faction === 'zhargi') {
    ctx.fillStyle = '#7a4dff';
    ctx.beginPath();
    if (hullId === 'iskra') ctx.arc(0, 0, px * 0.16, 0, Math.PI * 2);
    else if (hullId === 'monolit') {
      ctx.fillStyle = '#ff7a32';
      ctx.arc(px * 0.15, 0, px * 0.16, 0, Math.PI * 2);
    } else if (hullId === 'korob') ctx.arc(px * 0.05, -px * 0.02, px * 0.1, 0, Math.PI * 2);
    else {
      ctx.moveTo(px * 0.72, 0);
      ctx.lineTo(px * 0.42, px * 0.1);
      ctx.lineTo(px * 0.42, -px * 0.1);
    }
    ctx.fill();
  }
  if (q.glow && faction !== 'taeyori') {
    ctx.globalCompositeOperation = 'lighter';
    const flame = ctx.createRadialGradient(-px * 0.55, 0, 1, -px * 0.55, 0, px * 0.28);
    flame.addColorStop(0, FACTION_ENGINE[faction as keyof typeof FACTION_ENGINE] ?? '#9fd4ff');
    flame.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flame;
    const engines = faction === 'human' ? [-0.16, 0.16] : [0];
    for (const oy of engines) {
      ctx.beginPath();
      ctx.arc(-px * 0.55, px * oy, px * (faction === 'human' ? 0.16 : 0.28), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  } else if (q.glow && faction === 'taeyori') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(190,160,255,.45)';
    ctx.beginPath();
    ctx.arc(px * 0.15, 0, px * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  cache.set(key, c);
  if (cache.size > 420) cache.clear();
  return c;
}

type HullClass = 'scout' | 'strike' | 'haul' | 'cru' | 'cap';

function hullClass(hullId: string): HullClass {
  if (hullId === 'korob') return 'haul';
  if (hullId === 'monolit') return 'cap';
  if (hullId === 'oplot') return 'cru';
  if (hullId === 'klinok') return 'strike';
  return 'scout';
}

function traceHull(ctx: CanvasRenderingContext2D, hullId: string, faction: string, s: number): void {
  const cls = hullClass(hullId);
  ctx.beginPath();
  if (faction === 'human') humanHull(ctx, s, cls);
  else if (faction === 'zhargi') zhargiHull(ctx, s, cls);
  else if (faction === 'kvissae') kvissaeHull(ctx, s, cls);
  else if (faction === 'taeyori') taeyoriHull(ctx, s, cls);
  else if (faction === 'virex') virexHull(ctx, s, cls);
  else if (faction === 'omnir') omnirHull(ctx, s, cls);
  else if (hullId === 'korob') {
    ctx.moveTo(s, 0);
    ctx.lineTo(s * 0.45, s * 0.62);
    ctx.lineTo(-s * 0.85, s * 0.7);
    ctx.lineTo(-s, s * 0.25);
    ctx.lineTo(-s, -s * 0.25);
    ctx.lineTo(-s * 0.85, -s * 0.7);
    ctx.lineTo(s * 0.45, -s * 0.62);
  } else if (hullId === 'monolit') {
    ctx.moveTo(s, 0);
    ctx.lineTo(s * 0.15, s * 0.78);
    ctx.lineTo(-s * 0.35, s * 0.9);
    ctx.lineTo(-s, s * 0.4);
    ctx.lineTo(-s * 0.7, 0);
    ctx.lineTo(-s, -s * 0.4);
    ctx.lineTo(-s * 0.35, -s * 0.9);
    ctx.lineTo(s * 0.15, -s * 0.78);
  } else if (hullId === 'oplot') {
    ctx.moveTo(s * 1.05, 0);
    ctx.lineTo(s * 0.2, s * 0.5);
    ctx.lineTo(-s * 0.2, s * 0.72);
    ctx.lineTo(-s, s * 0.28);
    ctx.lineTo(-s * 0.55, 0);
    ctx.lineTo(-s, -s * 0.28);
    ctx.lineTo(-s * 0.2, -s * 0.72);
    ctx.lineTo(s * 0.2, -s * 0.5);
  } else if (hullId === 'klinok') {
    ctx.moveTo(s * 1.1, 0);
    ctx.lineTo(-s * 0.05, s * 0.32);
    ctx.lineTo(-s * 0.55, s * 0.95);
    ctx.lineTo(-s, s * 0.22);
    ctx.lineTo(-s * 0.35, 0);
    ctx.lineTo(-s, -s * 0.22);
    ctx.lineTo(-s * 0.55, -s * 0.95);
    ctx.lineTo(-s * 0.05, -s * 0.32);
  } else {
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.15, s * 0.62);
    ctx.lineTo(-s, s * 0.18);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s, -s * 0.18);
    ctx.lineTo(-s * 0.15, -s * 0.62);
  }
  ctx.closePath();
}

function humanHull(ctx: CanvasRenderingContext2D, s: number, cls: HullClass): void {
  if (cls === 'scout') {
    ctx.rect(-s * 1.05, s * 0.4, s * 1.9, s * 0.13);
    ctx.rect(-s * 1.05, -s * 0.53, s * 1.9, s * 0.13);
    ctx.moveTo(s * 0.18, 0);
    ctx.arc(-s * 0.02, 0, s * 0.2, 0, Math.PI * 2);
    return;
  }
  if (cls === 'strike') {
    ctx.moveTo(s * 0.85, 0);
    ctx.lineTo(s * 0.45, s * 0.32);
    ctx.lineTo(-s * 0.35, s * 0.38);
    ctx.lineTo(-s * 0.85, s * 0.14);
    ctx.lineTo(-s * 0.7, 0);
    ctx.lineTo(-s * 0.85, -s * 0.14);
    ctx.lineTo(-s * 0.35, -s * 0.38);
    ctx.lineTo(s * 0.45, -s * 0.32);
    return;
  }
  if (cls === 'haul') {
    ctx.rect(s * 0.55, -s * 0.08, s * 0.4, s * 0.16);
    ctx.rect(-s * 1.05, -s * 0.04, s * 1.55, s * 0.08);
    ctx.rect(-s * 0.15, s * 0.16, s * 0.42, s * 0.28);
    ctx.rect(-s * 0.7, s * 0.16, s * 0.42, s * 0.28);
    ctx.rect(-s * 0.95, -s * 0.44, s * 0.38, s * 0.28);
    ctx.rect(-s * 0.4, -s * 0.44, s * 0.42, s * 0.28);
    return;
  }
  if (cls === 'cru') {
    ctx.moveTo(s * 0.95, 0);
    ctx.lineTo(s * 0.2, s * 0.72);
    ctx.lineTo(-s * 0.85, s * 0.62);
    ctx.lineTo(-s * 1.05, s * 0.18);
    ctx.lineTo(-s * 0.55, 0);
    ctx.lineTo(-s * 1.05, -s * 0.18);
    ctx.lineTo(-s * 0.85, -s * 0.62);
    ctx.lineTo(s * 0.2, -s * 0.72);
    ctx.moveTo(-s * 0.15, s * 0.08);
    ctx.lineTo(s * 0.05, s * 0.08);
    ctx.lineTo(s * 0.05, -s * 0.22);
    ctx.lineTo(-s * 0.15, -s * 0.22);
    return;
  }
  ctx.rect(-s * 0.85, -s * 0.16, s * 1.5, s * 0.32);
  ctx.rect(-s * 0.15, -s * 0.72, s * 0.28, s * 1.44);
  ctx.moveTo(s * 0.55, 0);
  ctx.lineTo(s * 0.95, s * 0.1);
  ctx.lineTo(s * 0.95, -s * 0.1);
}

function zhargiHull(ctx: CanvasRenderingContext2D, s: number, cls: HullClass): void {
  if (cls === 'scout') {
    const teeth = 14;
    for (let i = 0; i <= teeth; i++) {
      const a = (i / teeth) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.92 : s * 0.58;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    return;
  }
  if (cls === 'strike') {
    ctx.moveTo(s * 0.22, -s * 1.05);
    ctx.lineTo(s * 0.42, -s * 0.35);
    ctx.lineTo(s * 0.28, s * 0.55);
    ctx.lineTo(-s * 0.28, s * 0.72);
    ctx.lineTo(-s * 0.42, -s * 0.35);
    return;
  }
  if (cls === 'haul') {
    ctx.ellipse(-s * 0.05, -s * 0.08, s * 0.62, s * 0.4, 0, 0, Math.PI * 2);
    ctx.rect(-s * 0.48, s * 0.18, s * 0.16, s * 0.32);
    ctx.rect(s * 0.18, s * 0.18, s * 0.16, s * 0.32);
    ctx.rect(-s * 0.22, s * 0.22, s * 0.14, s * 0.26);
    ctx.moveTo(s * 0.5, -s * 0.02);
    ctx.lineTo(s * 0.92, s * 0.08);
    ctx.lineTo(s * 0.88, -s * 0.1);
    return;
  }
  if (cls === 'cru') {
    ctx.rect(-s * 0.75, -s * 0.72, s * 0.28, s * 1.15);
    ctx.rect(s * 0.35, -s * 0.72, s * 0.28, s * 1.15);
    ctx.rect(-s * 0.75, -s * 0.18, s * 1.38, s * 0.36);
    return;
  }
  ctx.rect(-s * 0.85, -s * 0.08, s * 1.15, s * 0.42);
  ctx.moveTo(s * 0.3, 0);
  ctx.lineTo(s * 1.15, s * 0.16);
  ctx.lineTo(s * 1.15, -s * 0.2);
  ctx.lineTo(s * 0.3, -s * 0.28);
  ctx.rect(-s * 0.2, -s * 0.62, s * 0.48, s * 0.32);
}

function kvissaeHull(ctx: CanvasRenderingContext2D, s: number, cls: HullClass): void {
  if (cls === 'scout') {
    ctx.moveTo(s * 1.25, 0);
    ctx.lineTo(s * 0.2, s * 0.06);
    ctx.lineTo(-s * 0.15, s * 0.72);
    ctx.lineTo(-s * 0.85, s * 0.08);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.85, -s * 0.08);
    ctx.lineTo(-s * 0.15, -s * 0.72);
    ctx.lineTo(s * 0.2, -s * 0.06);
    return;
  }
  if (cls === 'strike') {
    ctx.moveTo(s * 1.05, 0);
    ctx.lineTo(s * 0.25, s * 0.1);
    ctx.lineTo(-s * 0.05, s * 0.55);
    ctx.lineTo(-s * 0.55, s * 0.95);
    ctx.lineTo(-s * 0.9, s * 0.2);
    ctx.lineTo(-s * 0.45, 0);
    ctx.lineTo(-s * 0.9, -s * 0.2);
    ctx.lineTo(-s * 0.55, -s * 0.95);
    ctx.lineTo(-s * 0.05, -s * 0.55);
    ctx.lineTo(s * 0.25, -s * 0.1);
    return;
  }
  if (cls === 'haul') {
    ctx.moveTo(s * 1.35, 0);
    ctx.lineTo(s * 0.7, s * 0.05);
    ctx.lineTo(s * 0.15, s * 0.16);
    ctx.lineTo(-s * 0.35, s * 0.22);
    ctx.lineTo(-s * 1.05, s * 0.55);
    ctx.lineTo(-s * 0.2, 0);
    ctx.lineTo(-s * 1.05, -s * 0.55);
    ctx.lineTo(-s * 0.35, -s * 0.22);
    ctx.lineTo(s * 0.15, -s * 0.16);
    ctx.lineTo(s * 0.7, -s * 0.05);
    return;
  }
  if (cls === 'cru') {
    ctx.moveTo(s * 0.85, 0);
    ctx.lineTo(s * 0.15, s * 0.18);
    ctx.lineTo(-s * 0.15, s * 0.95);
    ctx.lineTo(-s * 0.55, s * 0.35);
    ctx.lineTo(-s * 0.95, s * 0.12);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.95, -s * 0.12);
    ctx.lineTo(-s * 0.55, -s * 0.35);
    ctx.lineTo(-s * 0.15, -s * 0.95);
    ctx.lineTo(s * 0.15, -s * 0.18);
    return;
  }
  ctx.moveTo(s * 0.55, 0);
  ctx.bezierCurveTo(s * 0.85, s * 0.45, -s * 0.2, s * 0.55, -s * 0.35, 0);
  ctx.bezierCurveTo(-s * 0.2, -s * 0.55, s * 0.85, -s * 0.45, s * 0.55, 0);
  ctx.moveTo(s * 0.95, s * 0.08);
  ctx.lineTo(s * 0.55, s * 0.22);
  ctx.lineTo(s * 0.7, 0);
  ctx.lineTo(s * 0.55, -s * 0.22);
  ctx.lineTo(s * 0.95, -s * 0.08);
}

function taeyoriHull(ctx: CanvasRenderingContext2D, s: number, cls: HullClass): void {
  if (cls === 'scout') {
    ctx.moveTo(s * 1.25, 0);
    ctx.lineTo(s * 0.05, s * 0.07);
    ctx.lineTo(-s * 1.05, 0);
    ctx.lineTo(s * 0.05, -s * 0.07);
    return;
  }
  if (cls === 'strike') {
    ctx.moveTo(s * 0.15, 0);
    ctx.bezierCurveTo(s * 0.85, s * 0.55, s * 0.85, -s * 0.55, s * 0.15, 0);
    ctx.moveTo(-s * 0.05, 0);
    ctx.bezierCurveTo(-s * 0.7, s * 0.42, -s * 0.7, -s * 0.42, -s * 0.05, 0);
    return;
  }
  if (cls === 'haul') {
    ctx.moveTo(s * 0.72, 0);
    ctx.lineTo(s * 0.28, s * 0.48);
    ctx.lineTo(-s * 0.22, s * 0.62);
    ctx.lineTo(-s * 0.7, s * 0.18);
    ctx.lineTo(-s * 0.55, 0);
    ctx.lineTo(-s * 0.7, -s * 0.18);
    ctx.lineTo(-s * 0.22, -s * 0.62);
    ctx.lineTo(s * 0.28, -s * 0.48);
    return;
  }
  if (cls === 'cru') {
    ctx.moveTo(s * 0.85, 0);
    ctx.lineTo(s * 0.2, s * 0.22);
    ctx.lineTo(-s * 0.15, s * 0.55);
    ctx.lineTo(-s * 0.55, s * 0.12);
    ctx.lineTo(-s * 0.2, 0);
    ctx.lineTo(-s * 0.55, -s * 0.12);
    ctx.lineTo(-s * 0.15, -s * 0.55);
    ctx.lineTo(s * 0.2, -s * 0.22);
    ctx.moveTo(0, s * 0.85);
    ctx.lineTo(s * 0.12, s * 0.35);
    ctx.lineTo(-s * 0.12, s * 0.35);
    ctx.moveTo(0, -s * 0.85);
    ctx.lineTo(s * 0.12, -s * 0.35);
    ctx.lineTo(-s * 0.12, -s * 0.35);
    return;
  }
  ctx.moveTo(0, -s * 0.95);
  ctx.lineTo(s * 0.28, -s * 0.15);
  ctx.lineTo(s * 0.85, 0);
  ctx.lineTo(s * 0.22, s * 0.22);
  ctx.lineTo(0, s * 0.9);
  ctx.lineTo(-s * 0.28, s * 0.15);
  ctx.lineTo(-s * 0.8, 0);
  ctx.lineTo(-s * 0.18, -s * 0.28);
}

function virexHull(ctx: CanvasRenderingContext2D, s: number, cls: HullClass): void {
  if (cls === 'scout') {
    ctx.moveTo(s * 0.95, 0);
    ctx.lineTo(s * 0.15, s * 0.1);
    ctx.lineTo(-s * 0.05, s * 0.42);
    ctx.lineTo(-s * 0.35, s * 0.12);
    ctx.lineTo(-s * 0.85, s * 0.08);
    ctx.lineTo(-s * 0.45, 0);
    ctx.lineTo(-s * 0.85, -s * 0.08);
    ctx.lineTo(-s * 0.35, -s * 0.12);
    ctx.lineTo(-s * 0.05, -s * 0.42);
    ctx.lineTo(s * 0.15, -s * 0.1);
    return;
  }
  if (cls === 'strike') {
    ctx.moveTo(s * 0.7, 0);
    ctx.lineTo(s * 0.15, s * 0.55);
    ctx.lineTo(-s * 0.55, s * 0.48);
    ctx.lineTo(-s * 0.9, s * 0.12);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.9, -s * 0.12);
    ctx.lineTo(-s * 0.55, -s * 0.48);
    ctx.lineTo(s * 0.15, -s * 0.55);
    ctx.moveTo(s * 0.85, s * 0.18);
    ctx.lineTo(s * 0.45, s * 0.05);
    ctx.lineTo(s * 0.45, -s * 0.05);
    ctx.lineTo(s * 0.85, -s * 0.18);
    return;
  }
  if (cls === 'haul') {
    ctx.moveTo(s * 0.35, 0);
    ctx.bezierCurveTo(s * 0.9, s * 0.55, -s * 0.4, s * 0.7, -s * 0.85, s * 0.15);
    ctx.quadraticCurveTo(-s * 0.45, 0, -s * 0.85, -s * 0.15);
    ctx.bezierCurveTo(-s * 0.4, -s * 0.7, s * 0.9, -s * 0.55, s * 0.35, 0);
    return;
  }
  if (cls === 'cru') {
    ctx.moveTo(s * 1.05, s * 0.35);
    ctx.lineTo(s * 0.15, s * 0.08);
    ctx.lineTo(-s * 0.15, s * 0.28);
    ctx.lineTo(-s * 0.75, s * 0.55);
    ctx.lineTo(-s * 0.95, s * 0.05);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.85, -s * 0.22);
    ctx.lineTo(-s * 0.2, -s * 0.12);
    ctx.lineTo(s * 0.25, -s * 0.08);
    ctx.lineTo(s * 0.9, -s * 0.42);
    return;
  }
  ctx.moveTo(s * 0.15, 0);
  ctx.lineTo(s * 0.55, s * 0.45);
  ctx.lineTo(s * 0.05, s * 0.7);
  ctx.lineTo(-s * 0.45, s * 0.35);
  ctx.lineTo(-s * 0.95, s * 0.55);
  ctx.lineTo(-s * 0.7, 0);
  ctx.lineTo(-s * 0.95, -s * 0.5);
  ctx.lineTo(-s * 0.2, -s * 0.22);
  ctx.lineTo(s * 0.1, -s * 0.62);
  ctx.lineTo(s * 0.7, -s * 0.18);
}

function omnirHull(ctx: CanvasRenderingContext2D, s: number, cls: HullClass): void {
  if (cls === 'scout') {
    ctx.moveTo(s * 1.1, 0);
    ctx.lineTo(s * 0.2, s * 0.16);
    ctx.lineTo(s * 0.45, s * 0.55);
    ctx.lineTo(-s * 0.35, s * 0.12);
    ctx.lineTo(-s * 0.95, s * 0.28);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.95, -s * 0.28);
    ctx.lineTo(-s * 0.35, -s * 0.12);
    ctx.lineTo(s * 0.45, -s * 0.55);
    ctx.lineTo(s * 0.2, -s * 0.16);
    return;
  }
  if (cls === 'strike') {
    ctx.moveTo(s * 0.9, s * 0.05);
    ctx.lineTo(s * 0.1, s * 0.15);
    ctx.lineTo(-s * 0.2, s * 0.85);
    ctx.lineTo(-s * 0.7, s * 0.2);
    ctx.lineTo(-s * 1.0, 0);
    ctx.lineTo(-s * 0.55, -s * 0.15);
    ctx.lineTo(s * 0.15, -s * 0.55);
    ctx.lineTo(s * 0.7, -s * 0.1);
    return;
  }
  if (cls === 'haul') {
    ctx.moveTo(s * 0.85, 0);
    ctx.bezierCurveTo(s * 0.4, s * 0.7, -s * 0.6, s * 0.65, -s * 0.95, s * 0.1);
    ctx.quadraticCurveTo(-s * 0.4, 0, -s * 0.95, -s * 0.1);
    ctx.bezierCurveTo(-s * 0.6, -s * 0.65, s * 0.4, -s * 0.7, s * 0.85, 0);
    return;
  }
  if (cls === 'cru') {
    ctx.moveTo(s * 0.95, 0);
    ctx.lineTo(s * 0.25, s * 0.35);
    ctx.lineTo(s * 0.55, s * 0.85);
    ctx.lineTo(-s * 0.15, s * 0.4);
    ctx.lineTo(-s * 0.65, s * 0.7);
    ctx.lineTo(-s * 0.95, s * 0.05);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.95, -s * 0.05);
    ctx.lineTo(-s * 0.65, -s * 0.7);
    ctx.lineTo(-s * 0.15, -s * 0.4);
    ctx.lineTo(s * 0.55, -s * 0.85);
    ctx.lineTo(s * 0.25, -s * 0.35);
    return;
  }
  ctx.moveTo(s * 1.05, 0);
  ctx.lineTo(s * 0.15, s * 0.28);
  ctx.lineTo(s * 0.4, s * 0.75);
  ctx.lineTo(-s * 0.2, s * 0.22);
  ctx.lineTo(-s * 0.15, s * 0.9);
  ctx.lineTo(-s * 0.7, s * 0.15);
  ctx.lineTo(-s * 1.05, s * 0.4);
  ctx.lineTo(-s * 0.45, 0);
  ctx.lineTo(-s * 1.05, -s * 0.4);
  ctx.lineTo(-s * 0.7, -s * 0.15);
  ctx.lineTo(-s * 0.15, -s * 0.9);
  ctx.lineTo(-s * 0.2, -s * 0.22);
  ctx.lineTo(s * 0.4, -s * 0.75);
  ctx.lineTo(s * 0.15, -s * 0.28);
}

/** Двойной удар и пауза. В бою период короче. */
export function heartPulse(time: number, combat: boolean): number {
  const period = combat ? 0.46 : 1.12;
  const u = ((time % period) + period) % period / period;
  const bump = (center: number, width: number) => {
    const d = Math.abs(u - center);
    return Math.exp(-(d * d) / (width * width));
  };
  return Math.min(1, bump(0.07, 0.038) + bump(0.2, 0.03) * 0.82);
}

export function paintShipAura(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  faction: string,
  hullId: string,
  time: number,
  combat: boolean,
): void {
  if (faction !== 'omnir' && faction !== 'taeyori' && faction !== 'zhargi' && faction !== 'human') return;
  const cls = hullClass(hullId);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = size * 0.42;
  if (faction === 'omnir') drawVeins(ctx, s, cls, heartPulse(time, combat));
  else if (faction === 'taeyori') drawCrystalField(ctx, s, cls, time);
  else if (faction === 'human' && cls === 'strike') drawTurretBelt(ctx, s, time);
  else if (faction === 'zhargi') drawRuneSeams(ctx, s, cls, time);
  ctx.restore();
}

function drawTurretBelt(ctx: CanvasRenderingContext2D, s: number, time: number): void {
  ctx.save();
  ctx.rotate(time * 1.4);
  ctx.strokeStyle = 'rgba(160,200,255,.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.72, s * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#d7e6ff';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72);
    ctx.rotate(a);
    ctx.fillRect(-3, -2, 8, 4);
    ctx.restore();
  }
  ctx.restore();
}

function drawVeins(ctx: CanvasRenderingContext2D, s: number, cls: HullClass, pulse: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,36,58,${0.28 + pulse * 0.72})`;
  ctx.shadowColor = '#ff2438';
  ctx.shadowBlur = 6 + pulse * 10;
  ctx.lineWidth = 1.2 + pulse * 2.2;
  ctx.beginPath();
  const span = cls === 'haul' ? 0.55 : cls === 'cru' || cls === 'cap' ? 0.42 : 0.22;
  ctx.moveTo(s * 0.7, 0);
  ctx.quadraticCurveTo(0, s * span, -s * 0.75, s * span * 0.35);
  ctx.moveTo(s * 0.55, s * 0.08);
  ctx.quadraticCurveTo(-s * 0.1, -s * span, -s * 0.7, 0);
  if (cls === 'cap' || cls === 'cru') {
    ctx.moveTo(s * 0.2, s * 0.2);
    ctx.lineTo(-s * 0.4, s * 0.45);
    ctx.moveTo(s * 0.2, -s * 0.2);
    ctx.lineTo(-s * 0.35, -s * 0.4);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCrystalField(ctx: CanvasRenderingContext2D, s: number, cls: HullClass, time: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(214,186,255,.85)';
  ctx.fillStyle = 'rgba(186,140,255,.9)';
  const rings = cls === 'scout' ? 0 : cls === 'strike' ? 1 : cls === 'cap' ? 2 : 1;
  for (let r = 0; r < rings; r++) {
    ctx.save();
    ctx.rotate(time * (r % 2 === 0 ? 0.7 : -0.45) + r);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * (0.85 + r * 0.28), s * (0.28 + r * 0.08), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const shards = cls === 'scout' ? 2 : cls === 'haul' ? 5 : cls === 'cap' ? 6 : 3;
  for (let i = 0; i < shards; i++) {
    const a = time * 0.8 + (i / shards) * Math.PI * 2;
    const rad = s * (cls === 'scout' ? 0.35 : 0.72);
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad * 0.45;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 0);
    ctx.lineTo(0, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawRuneSeams(ctx: CanvasRenderingContext2D, s: number, cls: HullClass, time: number): void {
  const glow = 0.45 + Math.sin(time * 2.2) * 0.15;
  ctx.strokeStyle = `rgba(255,140,60,${glow})`;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(s * 0.55, 0);
  ctx.lineTo(-s * 0.55, 0);
  const chevrons = cls === 'cap' ? 4 : cls === 'scout' ? 2 : 3;
  for (let i = 0; i < chevrons; i++) {
    const x = s * (0.35 - i * 0.28);
    ctx.moveTo(x, 0);
    ctx.lineTo(x - s * 0.12, s * 0.16);
    ctx.moveTo(x, 0);
    ctx.lineTo(x - s * 0.12, -s * 0.16);
  }
  ctx.stroke();
}

function shade(hex: string, delta: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return hex;
  const ch = (shift: number) => Math.max(0, Math.min(255, ((n >> shift) & 255) + delta));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
