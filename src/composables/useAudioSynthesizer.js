/**
 * useAudioSynthesizer Composable
 * Zero-asset Web Audio API sound synthesis engine for OmniTrack notifications.
 * Synthesizes 4 distinct psychoacoustic chimes in real time without external mp3/wav files.
 */

export function useAudioSynthesizer() {
  const isSoundEnabled = () => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return true;
      const v = window.localStorage.getItem("omnitrack:sound_enabled");
      return v === null ? true : v === "1" || v === "true";
    } catch (_) {
      return true;
    }
  };

  const setSoundEnabled = (enabled) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("omnitrack:sound_enabled", enabled ? "1" : "0");
      }
    } catch (_) {}
  };

  const getAudioContext = () => {
    if (typeof window === "undefined" || !isSoundEnabled()) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  };

  /**
   * T-10m Upcoming Block Alert:
   * Distinct gentle melodic 4-bell phrase:
   * F#5 (739.99 Hz) -> A#5 (932.33 Hz) -> C#6 (1108.73 Hz) -> F#6 (1479.98 Hz)
   * Lasts ~2.3 seconds with warm ringing resonance.
   */
  const playUpcoming10mChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [
        { freq: 739.99, delay: 0, dur: 1.2, gain: 0.16 },
        { freq: 932.33, delay: 0.28, dur: 1.2, gain: 0.16 },
        { freq: 1108.73, delay: 0.56, dur: 1.3, gain: 0.15 },
        { freq: 1479.98, delay: 0.84, dur: 1.45, gain: 0.14 }
      ];
      notes.forEach(({ freq, delay, dur, gain: maxGain }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + delay;
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(maxGain, t + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
      });
    } catch (e) {}
  };

  /**
   * T-0 Action Focus Triad:
   * Assertive resonant fanfare:
   * C5 (523.25) -> E5 (659.25) -> G5 (783.99) -> Resonant Chord (C5+E5+G5+C6)
   * Lasts ~2.3 seconds signaling exact start.
   */
  const playStartOnTimeChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const arp = [
        { freq: 523.25, delay: 0, dur: 0.35, gain: 0.18 },
        { freq: 659.25, delay: 0.18, dur: 0.35, gain: 0.18 },
        { freq: 783.99, delay: 0.36, dur: 0.40, gain: 0.20 }
      ];
      arp.forEach(({ freq, delay, dur, gain: maxGain }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + delay;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(maxGain, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
      });

      // Resonant triad at 0.58s ringing out together
      const chord = [523.25, 659.25, 783.99, 1046.50];
      const chordStart = ctx.currentTime + 0.58;
      const chordDur = 1.72;
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, chordStart);
        gain.gain.setValueAtTime(0.01, chordStart);
        gain.gain.linearRampToValueAtTime(0.07, chordStart + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0005, chordStart + chordDur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(chordStart);
        osc.stop(chordStart + chordDur);
      });
    } catch (e) {}
  };

  /**
   * Block Overrun Alert:
   * Descending warning gong: G5 (783.99) -> Eb5 (622.25) -> C5 (523.25) -> G4 (392.00)
   * Lasts ~2.0 seconds.
   */
  const playOverrunChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [
        { freq: 783.99, delay: 0, dur: 0.6, gain: 0.14 },
        { freq: 622.25, delay: 0.22, dur: 0.6, gain: 0.14 },
        { freq: 523.25, delay: 0.44, dur: 0.7, gain: 0.14 },
        { freq: 392.00, delay: 0.66, dur: 1.34, gain: 0.16 }
      ];
      notes.forEach(({ freq, delay, dur, gain: maxGain }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + delay;
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(maxGain, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
      });
    } catch (e) {}
  };

  /**
   * Inactivity Ping:
   * Warm resonant ping: D5 (587.33) -> A5 (880.0) lasting ~1.4 seconds.
   */
  const playInactivityChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const t = ctx.currentTime;
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, t);
      gain1.gain.setValueAtTime(0.01, t);
      gain1.gain.linearRampToValueAtTime(0.16, t + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.5);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      const t2 = t + 0.20;
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, t2);
      gain2.gain.setValueAtTime(0.01, t2);
      gain2.gain.linearRampToValueAtTime(0.16, t2 + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.0005, t2 + 1.20);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t2);
      osc2.stop(t2 + 1.20);
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
    isSoundEnabled,
    setSoundEnabled,
  };
}
