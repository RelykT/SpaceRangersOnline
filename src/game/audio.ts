export function createAudio() {
  let ctx: AudioContext | null = null;
  let enabled = localStorage.getItem('kromka-audio') !== '0';

  function ac(): AudioContext | null {
    if (!enabled) return null;
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq: number, dur: number, type: OscillatorType, gain: number): void {
    const audio = ac();
    if (!audio) return;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  }

  return {
    get enabled() {
      return enabled;
    },
    toggle(): boolean {
      enabled = !enabled;
      localStorage.setItem('kromka-audio', enabled ? '1' : '0');
      return enabled;
    },
    blip() {
      tone(620, 0.05, 'square', 0.03);
    },
    laser() {
      tone(180 + Math.random() * 40, 0.08, 'sawtooth', 0.02);
    },
    explode() {
      tone(90, 0.3, 'triangle', 0.05);
    },
    jump() {
      tone(140, 0.4, 'sine', 0.04);
    },
  };
}

export type AudioBus = ReturnType<typeof createAudio>;
