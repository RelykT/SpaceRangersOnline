import { FACTION_COLOR } from '../sim/content';
import { iconImage, portraitImage, ready } from './art';
import type { CareerId, PlayableRace } from '../sim/types';

/** Painted portrait from the owner's set. Variant pages through the race's faces. */
export function drawPortrait(canvas: HTMLCanvasElement, race: PlayableRace | 'omnir', portrait: number, _time: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const img = portraitImage(race, portrait);
  ctx.clearRect(0, 0, w, h);
  if (ready(img)) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = '#121826';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = 'rgba(224,181,101,.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
}

export function drawEmblem(canvas: HTMLCanvasElement, race: PlayableRace): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  ctx.clearRect(0, 0, w, canvas.height);
  drawEmblemMark(ctx, w / 2, canvas.height / 2, w * 0.42, race);
}

export function drawCareerBadge(canvas: HTMLCanvasElement, career: CareerId): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.strokeStyle = '#e0b565';
  ctx.fillStyle = 'rgba(224,181,101,.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (career === 'trader') {
    ctx.moveTo(-w * 0.28, h * 0.1);
    ctx.lineTo(w * 0.05, h * 0.28);
    ctx.lineTo(w * 0.32, -h * 0.05);
    ctx.lineTo(w * 0.1, -h * 0.28);
  } else if (career === 'soldier') {
    ctx.moveTo(0, -h * 0.34);
    ctx.lineTo(w * 0.16, h * 0.2);
    ctx.lineTo(0, h * 0.05);
    ctx.lineTo(-w * 0.16, h * 0.2);
  } else if (career === 'hunter') {
    ctx.arc(0, 0, w * 0.22, 0, Math.PI * 2);
    ctx.moveTo(w * 0.28, -h * 0.2);
    ctx.lineTo(-w * 0.05, h * 0.28);
  } else if (career === 'explorer') {
    ctx.moveTo(0, -h * 0.3);
    ctx.lineTo(w * 0.22, 0);
    ctx.lineTo(0, h * 0.3);
    ctx.lineTo(-w * 0.22, 0);
  } else {
    ctx.moveTo(-w * 0.3, h * 0.15);
    ctx.lineTo(w * 0.3, -h * 0.15);
    ctx.moveTo(w * 0.05, -h * 0.28);
    ctx.lineTo(w * 0.28, -h * 0.05);
  }
  ctx.fill();
  ctx.stroke();
}

export function drawGoodIcon(canvas: HTMLCanvasElement, goodId: string): void {
  paintIcon(canvas, iconImage('good', goodId));
}

export function drawModuleIcon(canvas: HTMLCanvasElement, modId: string): void {
  paintIcon(canvas, iconImage('mod', modId));
}

function paintIcon(canvas: HTMLCanvasElement, img: HTMLImageElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width;
  ctx.clearRect(0, 0, s, canvas.height);
  if (ready(img)) ctx.drawImage(img, 0, 0, s, canvas.height);
}

function drawEmblemMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, race: PlayableRace): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = FACTION_COLOR[race];
  ctx.fillStyle = FACTION_COLOR[race];
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (race === 'human') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.7, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.7, 0);
    ctx.closePath();
  } else if (race === 'kvissae') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
  } else if (race === 'zhargi') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.8, r * 0.7);
    ctx.lineTo(-r * 0.8, r * 0.7);
  } else if (race === 'taeyori') {
    ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.5);
  } else {
    ctx.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
  }
  ctx.stroke();
  ctx.restore();
}

