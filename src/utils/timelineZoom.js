// How many hours "Day at a glance" shows across. Every screen offers 3h to 24h.
// A phone (under 640px) is too narrow for 6h to read, so it opens on 3h.
export const PHONE_MAX_WIDTH = 640;

export const TIMELINE_ZOOM_OPTIONS = [3, 6, 12, 24];

export function defaultTimelineZoom(width, isToday) {
  if (width < PHONE_MAX_WIDTH) return 3;
  if (isToday) return 6; // keeps the now line centred with blocks either side of it
  return width < 1024 ? 12 : 24;
}
