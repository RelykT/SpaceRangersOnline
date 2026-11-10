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

  let bed: { osc: OscillatorNode; noise: AudioBufferSourceNode; gain: GainNode } | null = null;

  function ambient() {
    const audio = ac();
    if (!audio || bed) return;
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const noiseBuf = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = audio.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const gain = audio.createGain();
    gain.gain.value = 0.03;
    osc.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    noise.start();
    bed = { osc, noise, gain };
  }

  function hush() {
    bed?.osc.stop();
    bed?.noise.stop();
    bed = null;
  }

  return {
    get enabled() {
      return enabled;
    },
    toggle(): boolean {
      enabled = !enabled;
      localStorage.setItem('kromka-audio', enabled ? '1' : '0');
      if (!enabled) hush();
      else ambient();
      return enabled;
    },
    ambient,
    blip() {
      tone(740, 0.04, 'triangle', 0.03);
      tone(420, 0.07, 'sine', 0.02);
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
