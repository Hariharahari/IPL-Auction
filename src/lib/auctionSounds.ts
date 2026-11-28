// Web Audio API procedural sound synthesizer for IPL Live Auction
// Zero external MP3 dependencies - 100% synthesized in-browser

const SFX_MUTE_KEY = 'ipl_sfx_muted';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function isSfxMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SFX_MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SFX_MUTE_KEY, muted ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('ipl_sfx_mute_changed', { detail: muted }));
  } catch {}
}

export function toggleSfxMuted(): boolean {
  const next = !isSfxMuted();
  setSfxMuted(next);
  return next;
}

/**
 * Crisp ascending broadcast chime when a franchise places a bid.
 * Ascending notes (C5 -> E5 -> G5) with sparkling harmonic shimmer.
 */
export function playBidChime(): void {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: now, duration: 0.22, vol: 0.18 }, // C5
      { freq: 659.25, time: now + 0.07, duration: 0.25, vol: 0.22 }, // E5
      { freq: 783.99, time: now + 0.14, duration: 0.35, vol: 0.28 }, // G5
    ];

    notes.forEach(({ freq, time, duration, vol }) => {
      // Fundamental sine
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      // Soft harmonic triangle overtone
      const oscHarmonic = ctx.createOscillator();
      const gainHarmonic = ctx.createGain();
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(freq * 2, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      gainHarmonic.gain.setValueAtTime(0.001, time);
      gainHarmonic.gain.linearRampToValueAtTime(vol * 0.25, time + 0.015);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.7);

      osc.connect(gain);
      oscHarmonic.connect(gainHarmonic);
      gain.connect(ctx.destination);
      gainHarmonic.connect(ctx.destination);

      osc.start(time);
      oscHarmonic.start(time);
      osc.stop(time + duration + 0.05);
      oscHarmonic.stop(time + duration + 0.05);
    });
  } catch {
    // Autoplay policy or audio context error fallback
  }
}

/**
 * Subtle broadcast pulse tick during the final 3 seconds (3s, 2s, 1s).
 * Crisp stadium shot-clock pulse.
 */
export function playFinalTick(): void {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {}
}

/**
 * Realistic heavy wooden gavel slam triggered whenever a player is hammered SOLD.
 * Layer 1: Transient wood strike
 * Layer 2: Deep low-frequency sub-thud
 * Layer 3: Secondary sounding-board resonant knock
 */
export function playGavelSold(): void {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const playStrike = (time: number, primaryFreq: number, subFreq: number, masterVol: number) => {
      // Wood body impact (Triangle wave downward pitch sweep)
      const oscBody = ctx.createOscillator();
      const gainBody = ctx.createGain();
      oscBody.type = 'triangle';
      oscBody.frequency.setValueAtTime(primaryFreq, time);
      oscBody.frequency.exponentialRampToValueAtTime(70, time + 0.12);

      gainBody.gain.setValueAtTime(masterVol, time);
      gainBody.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      // Low-frequency sub-boom (Sine)
      const oscSub = ctx.createOscillator();
      const gainSub = ctx.createGain();
      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(subFreq, time);
      oscSub.frequency.exponentialRampToValueAtTime(38, time + 0.25);

      gainSub.gain.setValueAtTime(masterVol * 0.75, time);
      gainSub.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

      // Filtered transient click
      const oscClick = ctx.createOscillator();
      const gainClick = ctx.createGain();
      oscClick.type = 'square';
      oscClick.frequency.setValueAtTime(450, time);
      oscClick.frequency.exponentialRampToValueAtTime(120, time + 0.03);

      gainClick.gain.setValueAtTime(masterVol * 0.4, time);
      gainClick.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      oscBody.connect(gainBody);
      gainBody.connect(ctx.destination);

      oscSub.connect(gainSub);
      gainSub.connect(ctx.destination);

      oscClick.connect(gainClick);
      gainClick.connect(ctx.destination);

      oscBody.start(time);
      oscSub.start(time);
      oscClick.start(time);

      oscBody.stop(time + 0.2);
      oscSub.stop(time + 0.3);
      oscClick.stop(time + 0.05);
    };

    // Primary heavy gavel strike
    playStrike(now, 240, 110, 0.55);
    // Secondary realistic rebound knock
    playStrike(now + 0.12, 180, 85, 0.32);
  } catch {}
}

/**
 * Muted low thud triggered whenever a player is hammered UNSOLD.
 * Flat, dull, descending low-frequency thud.
 */
export function playUnsoldThud(): void {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Muted low-pass filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.25);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.3);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch {}
}
