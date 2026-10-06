import { computed } from 'vue';
import { toKind } from '../utils/activity.js';

export function useSessionDisplay(props, emit) {
  const formattedDuration = computed(() => {
    const sec = props.trackerSeconds || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  // Read the start off the payload the tracker persists, so a session restored
  // after a reload — or re-anchored by Adjust — shows its real start rather than
  // one inferred from the tick count. trackerSeconds is touched deliberately: it
  // is the dependency that makes this recompute as the session runs.
  const sessionStart = computed(() => {
    void props.trackerSeconds;
    if (!props.isTracking) return null;
    let ms = 0;
    try {
      const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
      if (p && p.startTime) ms = Number(p.startTime);
    } catch (e) {}
    if (!ms) ms = Date.now() - (props.trackerSeconds || 0) * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return {
      date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    };
  });

  const currentProjectLabel = computed(() => {
    if (props.trackerProject) {
      const found = (props.projects || []).find(p => p.name === props.trackerProject);
      return found ? (found.project_name || found.name) : props.trackerProject;
    }
    if (props.trackerBoundBlock && (props.trackerBoundBlock.project_name || props.trackerBoundBlock.project)) {
      return props.trackerBoundBlock.project_name || props.trackerBoundBlock.project;
    }
    return 'General Work (Internal)';
  });

  // Searchable Combobox options for the project / activity pickers (both lists
  // run past five entries). '' (General Work) is not a usable Combobox value,
  // so it travels as GENERAL and is translated back on the way out.
  const GENERAL = '__general__';
  const projectComboOptions = computed(() => [
    { label: 'General Work (Internal)', value: GENERAL },
    ...(props.projects || []).map(p => ({ label: p.project_name || p.name, value: p.name }))
  ]);
  const projectComboValue = computed(() => props.trackerProject || GENERAL);
  const pickProject = (v) => emit('update:project', !v || v === GENERAL ? '' : v);
  const natureComboOptions = computed(() =>
    (props.natureOptions || []).map(n => ({ label: n.label, value: n.value }))
  );
  const natureComboValue = computed(() => {
    return toKind(props.trackerNature || (props.trackerBoundBlock && props.trackerBoundBlock.task_nature));
  });
  // The Combobox can emit its display text instead of the value; toKind maps either back
  const pickNature = (v) => { if (v) emit('update:nature', toKind(v)); };

  return {
    projectComboOptions,
    projectComboValue,
    pickProject,
    natureComboOptions,
    natureComboValue,
    pickNature,
    formattedDuration,
    sessionStart,
    currentProjectLabel
  };
}
