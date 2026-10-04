/**
 * useAudioSynthesizer Composable
 * Zero-asset Web Audio API sound synthesis engine for OmniTrack notifications.
 * Synthesizes 4 distinct psychoacoustic chimes in real time without external mp3/wav files.
 */

export function useAudioSynthesizer() {
  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  };

  /**
   * T-10m Upcoming Block Alert:
   * Gentle rising bell: F#5 (739.99 Hz) -> A#5 (932.33 Hz)
   */
  const playUpcoming10mChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(739.99, ctx.currentTime);
      osc.frequency.setValueAtTime(932.33, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      // Audio autoplay policy or hardware muted
    }
  };

  /**
   * T-0 Action Focus Triad:
   * C5 (523.25) -> E5 (659.25) -> G5 (783.99)
   */
  const playStartOnTimeChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + idx * 0.12;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch (e) {}
  };

  /**
   * Block Overrun Alert:
   * Descending warning gong: G5 (783.99) -> Eb5 (622.25) -> C5 (523.25)
   */
  const playOverrunChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [783.99, 622.25, 523.25];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + idx * 0.15;
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (e) {}
  };

  /**
   * Inactivity Ping:
   * Classic warm ping: D5 (587.33) -> A5 (880.0)
   */
  const playInactivityChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  /**
   * Unlocks Web Audio context on user gesture (tap/key) for mobile browser policy
   */
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
    } catch (e) {}
  };

  return {
    playUpcoming10mChime,
    playStartOnTimeChime,
    playOverrunChime,
    playInactivityChime,
    unlockAudio,
  };
}
