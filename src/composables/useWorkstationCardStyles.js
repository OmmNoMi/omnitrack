export function useWorkstationCardStyles(opts) {
  const {
    isDarkMode,
    isTracking,
    trackerBlockName,
    todayDate,
    todayISO,
    nowMinute,
    _mins,
    hhmm,
    isNonWorkingNature
  } = opts;

  const PROJECT_HUES = [217, 262, 155, 24, 340, 187, 47, 291, 0, 120];
  const projectHue = (b) => {
    const key = String((b && (b.project || b.project_name)) || 'ad-hoc');
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return PROJECT_HUES[Math.abs(hash) % PROJECT_HUES.length];
  };

  const blockVisualState = (b) => {
    if (!b) return 'planned';
    if (b.status === 'Cancelled') return 'cancelled';
    if (b.status === 'Rescheduled') return 'rescheduled';
    if (b.is_away || isNonWorkingNature(b.task_nature)) return 'away';
    if (b.is_live_active || (isTracking.value && trackerBlockName.value === b.name)) return 'recording';
    if (b.status === 'Logged (Partial)') return 'partial';
    if (b.status === 'Logged (Over)') return 'over';
    const logged = parseFloat(b.actual_hours) || 0;
    if (b.status === 'Completed' || b.status === 'Logged (Full)' || logged > 0) return 'logged';
    const today = todayDate.value || todayISO();
    const date = b.work_date || '';
    if (b.status === 'Missed' || (date && date < today)) return 'missed';
    if (date === today) {
      const endMin = _mins(b.end_time);
      if (endMin > 0 && nowMinute.value >= endMin) return 'missed';
    }
    return 'planned';
  };

  const blockClass = (b) => {
    const st = blockVisualState(b);
    if (st === 'cancelled') return 'border-dotted line-through ' + (isDarkMode.value ? 'text-gray-700' : 'text-gray-600');
    if (st === 'rescheduled') return 'border-dashed ' + (isDarkMode.value ? 'text-gray-600 opacity-75' : 'text-gray-700 opacity-80');
    if (st === 'away') return 'border-dotted border-2';
    if (st === 'recording') return 'border-solid text-white ring-2 ring-red-500 ring-offset-1 z-20 shadow-md';
    if (st === 'logged' || st === 'over' || st === 'partial') return 'border-solid text-white';
    if (st === 'missed') return 'border-solid border-dashed';
    return 'border-solid';
  };

  const timelinePlannedStyle = (b) => {
    const h = projectHue(b);
    return isDarkMode.value
      ? { background: `hsl(${h} 45% 18% / .75)`, borderColor: `hsl(${h} 45% 42%)`, color: `hsl(${h} 70% 82%)` }
      : { background: `hsl(${h} 85% 96%)`, borderColor: `hsl(${h} 60% 68%)`, color: `hsl(${h} 55% 30%)` };
  };

  const timelineLoggedStyle = (r) => {
    if (r && r.is_live_active) {
      return {
        background: isDarkMode.value ? '#dc2626' : '#e11d48',
        borderColor: '#ef4444',
        color: '#fff',
        boxShadow: '0 0 10px rgba(225, 29, 72, 0.65)'
      };
    }
    if (!r.onPlan) return { background: isDarkMode.value ? '#9f1239' : '#e11d48' };
    const h = projectHue(r.block);
    return { background: isDarkMode.value ? `hsl(${h} 55% 40%)` : `hsl(${h} 62% 42%)` };
  };

  const blockStyle = (b) => {
    const st = blockVisualState(b);
    const dark = isDarkMode.value;
    const h = projectHue(b);
    if (st === 'cancelled') {
      return dark
        ? { background: '#1f2937', borderColor: '#374151' }
        : { background: '#f3f4f6', borderColor: '#d1d5db' };
    }
    if (st === 'rescheduled') {
      return dark
        ? { background: 'rgba(51, 65, 85, 0.35)', borderColor: '#64748b', color: '#94a3b8' }
        : { background: 'rgba(241, 245, 249, 0.85)', borderColor: '#94a3b8', color: '#475569' };
    }
    if (st === 'recording') {
      return dark
        ? { background: `hsl(${h} 50% 20% / .9)`, borderColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)' }
        : { background: `hsl(${h} 80% 95%)`, borderColor: '#dc2626', color: `hsl(${h} 65% 25%)`, boxShadow: '0 0 10px rgba(220, 38, 38, 0.25)' };
    }
    if (st === 'partial') {
      return dark
        ? { background: `hsl(${h} 50% 28%)`, borderColor: '#f59e0b', color: '#fff' }
        : { background: `hsl(${h} 55% 35%)`, borderColor: '#d97706', color: '#fff' };
    }
    if (st === 'over') {
      return dark
        ? { background: `hsl(270 50% 32%)`, borderColor: '#a855f7', color: '#fff' }
        : { background: `hsl(270 55% 38%)`, borderColor: '#9333ea', color: '#fff' };
    }
    if (st === 'away') {
      const hue = 38;
      return dark
        ? { background: `hsl(${hue} 60% 14% / .55)`, borderColor: `hsl(${hue} 50% 40%)`, color: `hsl(${hue} 80% 80%)` }
        : { background: `hsl(${hue} 90% 96%)`, borderColor: `hsl(${hue} 70% 70%)`, color: `hsl(${hue} 60% 30%)` };
    }
    if (st === 'logged') {
      return dark
        ? { background: `hsl(${h} 55% 34%)`, borderColor: `hsl(${h} 60% 46%)`, color: '#fff' }
        : { background: `hsl(${h} 62% 40%)`, borderColor: `hsl(${h} 65% 30%)`, color: '#fff' };
    }
    if (st === 'missed') {
      const stripe = dark ? `hsl(${h} 35% 55% / .18)` : `hsl(${h} 45% 45% / .14)`;
      const base = dark ? `hsl(${h} 30% 15%)` : `hsl(${h} 70% 98%)`;
      return {
        backgroundColor: base,
        backgroundImage: `repeating-linear-gradient(45deg, ${stripe} 0 2px, transparent 2px 10px)`,
        borderColor: dark ? `hsl(${h} 40% 45%)` : `hsl(${h} 45% 65%)`,
        color: dark ? `hsl(${h} 55% 82%)` : `hsl(${h} 60% 28%)`
      };
    }
    return dark
      ? { background: `hsl(${h} 50% 18%)`, borderColor: `hsl(${h} 55% 45%)`, color: `hsl(${h} 70% 85%)` }
      : { background: `hsl(${h} 90% 95%)`, borderColor: `hsl(${h} 60% 55%)`, color: `hsl(${h} 60% 30%)` };
  };

  const segTimeTitle = (seg) => {
    if (!seg) return '';
    if (seg.from_time && seg.to_time) return hhmm(seg.from_time) + '–' + hhmm(seg.to_time);
    const b = seg.block || seg;
    if (seg.is_segment) {
      if (seg.segment_type === 'tail') return hhmm(b.start_time) + '–24:00 (spans midnight)';
      if (seg.segment_type === 'head') return '00:00–' + hhmm(b.end_time) + ' (cont. from yesterday)';
    }
    return hhmm(b.start_time) + '–' + hhmm(b.end_time);
  };

  return {
    PROJECT_HUES,
    projectHue,
    blockVisualState,
    blockClass,
    timelinePlannedStyle,
    timelineLoggedStyle,
    blockStyle,
    segTimeTitle
  };
}
