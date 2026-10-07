/**
 * useWorkstationAudioSync Composable
 * Encapsulates:
 * 1. Psychoacoustic Web Audio synthesizer engine (chimes) and user gesture audio unlock
 * 2. Mobile and Desktop Notification permission management & Service Worker registration
 * 3. Inactivity and Block Overrun alert dispatching & governor checks
 */

import * as Vue from "vue";
import { blockTitle } from '../utils/blockTitle.js';
const { ref } = Vue;

export function useWorkstationAudioSync({
  postJSON,
  showToast,
  isTracking,
  trackerBoundBlock,
  confirmStillWorking
}) {
  // Web Audio Context Helper
  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  };

  // Distinct Web Audio Synthesizer Engine
  const playUpcoming10mChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      // Gentle rising bell: F#5 (739.99 Hz) -> A#5 (932.33 Hz)
      osc.frequency.setValueAtTime(739.99, ctx.currentTime);
      osc.frequency.setValueAtTime(932.33, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  };

  const playStartOnTimeChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      // Action Focus Triad: C5 (523.25) -> E5 (659.25) -> G5 (783.99)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + idx * 0.12;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.20, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch (e) {}
  };

  const playOverrunChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      // Descending warning gong: G5 (783.99) -> Eb5 (622.25) -> C5 (523.25)
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

  const playInactivityChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      // Classic warm ping: D5 (587.33) -> A5 (880.0)
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
                  try {
                    sub = await reg.pushManager.subscribe({
                      userVisibleOnly: true
                    });
                  } catch (subKeyErr) {
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

  const dispatchInactivityNotification = async (msg, tag = 'omnitrack-inactivity') => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    } catch (e) {}

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      const title = 'OmniTrack: Are you still working?';
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
          try {
            window.focus();
            if (typeof confirmStillWorking === 'function') {
              confirmStillWorking();
            }
          } catch (e) {}
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
      const overdueMins = curMins - endMins;
      const nowMs = Date.now();
      const timeSinceAlert = nowMs - (lastOverrunAlertTime.value || 0);
      const REPEAT_MS = 30 * 60 * 1000;

      if (!lastOverrunAlertTime.value || timeSinceAlert >= REPEAT_MS) {
        lastOverrunAlertTime.value = nowMs;
        playInactivityChime();
        const title = blockTitle(b, b.name);
        const endHHMM = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        const msg = overdueMins > 0
          ? `Planned block "${title}" ended at ${endHHMM} (${overdueMins}m overdue). Wrap up or continue?`
          : `Planned block "${title}" ended at ${endHHMM}. Wrap up or continue?`;

        dispatchInactivityNotification(msg, 'omnitrack-block-overrun');
      }
    }
  };

  return {
    playUpcoming10mChime,
    playStartOnTimeChime,
    playOverrunChime,
    playInactivityChime,
    unlockAudio,
    notificationPermission,
    showNotificationBanner,
    enableNotificationsUserGesture,
    dispatchInactivityNotification,
    lastOverrunAlertTime,
    checkBlockOverrun
  };
}
