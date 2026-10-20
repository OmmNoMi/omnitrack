/**
 * useWorkstationAudioSync Composable
 * Encapsulates:
 * 1. Psychoacoustic Web Audio synthesizer engine (chimes) and user gesture audio unlock
 * 2. Mobile and Desktop Notification permission management & Service Worker registration
 * 3. Inactivity and Block Overrun alert dispatching & governor checks
 */

import * as Vue from "vue";
import { blockTitle } from '../utils/blockTitle.js';
import { clock } from '../utils/clockTime.js';
const { ref } = Vue;

export function useWorkstationAudioSync({
  postJSON,
  showToast,
  isTracking,
  trackerBoundBlock
}) {
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

  // Web Audio Context Helper
  const getAudioContext = () => {
    if (typeof window === "undefined" || !isSoundEnabled()) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  };

  // Distinct Web Audio Synthesizer Engine
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

  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
    } catch (e) {}
  };

  const notificationPermission = ref(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const showNotificationBanner = ref(true);

  const enableNotificationsUserGesture = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Notifications are not supported in this browser.', 'warning');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      notificationPermission.value = perm;
      if (perm === 'granted') {
        showNotificationBanner.value = false;
        showToast('Notifications are on. You will get session and block reminders.', 'success');
        playStartOnTimeChime();
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.register('/assets/omnitrack/sw.js');
            if (reg && reg.showNotification) {
              await reg.showNotification('OmniTrack Notifications Enabled', {
                body: 'Session and block reminders are on.',
                icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
                badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
                tag: 'omnitrack-test',
                vibrate: [150, 100, 250]
              });
            }
            if ('pushManager' in reg) {
              try {
                let sub = await reg.pushManager.getSubscription();
                if (!sub) {
                  const session = typeof window !== 'undefined' ? window.OMNITRACK_SESSION : null;
                  const vapidKey = session && session.vapid_public_key;
                  const subOpts = { userVisibleOnly: true };
                  if (vapidKey) {
                    try {
                      const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
                      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
                      const rawData = window.atob(base64);
                      const arr = new Uint8Array(rawData.length);
                      for (let i = 0; i < rawData.length; ++i) arr[i] = rawData.charCodeAt(i);
                      subOpts.applicationServerKey = arr;
                    } catch (_) {
                      subOpts.applicationServerKey = vapidKey;
                    }
                  }
                  try {
                    sub = await reg.pushManager.subscribe(subOpts);
                  } catch (subKeyErr) {
                    try {
                      sub = await reg.pushManager.subscribe({ userVisibleOnly: true });
                    } catch (_) {}
                    console.debug('Standard push subscription attempt:', subKeyErr);
                  }
                }
                if (sub) {
                  const subJson = sub.toJSON();
                  await postJSON('register_push_subscription', {
                    endpoint: sub.endpoint,
                    p256dh: subJson.keys ? subJson.keys.p256dh : null,
                    auth: subJson.keys ? subJson.keys.auth : null,
                    device_type: (navigator.userAgent || '').slice(0, 140)
                  });
                }
              } catch (subErr) {
                console.debug('Push registration sync note:', subErr);
              }
            }
          } catch (e) {}
        }
      } else if (perm === 'denied') {
        showToast('Notifications are blocked. Allow them in your browser settings to get session reminders.', 'warning');
      }
    } catch (err) {
      showToast('Could not enable notifications: ' + (err && err.message || err), 'danger');
    }
  };

  // A notification states what happened; it cannot take an answer. Clicking it only brings the
  // page forward, where the question (if any) waits for one: it never answers it.
  const dispatchInactivityNotification = async (msg, tag = 'omnitrack-inactivity', heading = 'OmniTrack: Are you still working?') => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    } catch (e) {}

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      const title = heading;
      const options = {
        body: msg || 'Nothing logged in the running session for 30 minutes.',
        icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
        badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
        tag: tag,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: '/omnitrack' }
      };

      // 1. Mobile ServiceWorker showNotification (iOS Safari PWA & Android)
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            await reg.showNotification(title, options);
            return;
          }
        } catch (swErr) {}
        try {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SHOW_NOTIFICATION',
              title: title,
              options: options
            });
            return;
          }
        } catch (swMsgErr) {}
      }

      // 2. Desktop Notification constructor fallback
      try {
        const notif = new Notification(title, options);
        notif.onclick = () => {
          try { window.focus(); } catch (e) {}
        };
      } catch (e) {}
    } else if (Notification.permission === 'default') {
      try {
        const p = await Notification.requestPermission();
        notificationPermission.value = p;
      } catch (e) {}
    }
  };

  const lastOverrunAlertTime = ref(0);
  const checkBlockOverrun = () => {
    if (!isTracking.value || !trackerBoundBlock.value) return;
    const b = trackerBoundBlock.value;
    if (!b.end_time) return;
    const [eh, em] = b.end_time.split(':').map(Number);
    if (isNaN(eh) || isNaN(em)) return;

    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const endMins = eh * 60 + em;

    if (curMins >= endMins) {
      const nowMs = Date.now();
      const timeSinceAlert = nowMs - (lastOverrunAlertTime.value || 0);
      const REPEAT_MS = 30 * 60 * 1000;

      if (!lastOverrunAlertTime.value || timeSinceAlert >= REPEAT_MS) {
        lastOverrunAlertTime.value = nowMs;
        playOverrunChime();
        const title = blockTitle(b, b.name);
        const msg = `"${title}" was planned to end at ${clock(endMins)}. The session is still running.`;
        showToast(msg, 'warning');
        dispatchInactivityNotification(msg, 'omnitrack-block-overrun', 'OmniTrack: Planned block ended');
      }
    }
  };

  return {
    playUpcoming10mChime,
    playStartOnTimeChime,
    playOverrunChime,
    playInactivityChime,
    unlockAudio,
    isSoundEnabled,
    setSoundEnabled,
    notificationPermission,
    showNotificationBanner,
    enableNotificationsUserGesture,
    dispatchInactivityNotification,
    lastOverrunAlertTime,
    checkBlockOverrun
  };
}
