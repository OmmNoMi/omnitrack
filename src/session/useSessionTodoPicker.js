import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';

export function useSessionTodoPicker(props, emit) {
  const openTodos = computed(() => {
    return (props.assignedTasks || []).filter(t => {
      const st = (t.status || '').toLowerCase();
      return st !== 'closed' && st !== 'cancelled' && st !== 'completed';
    });
  });

  const todayPlannedBlocks = computed(() => {
    return (props.workBlocks || []).filter(b => {
      return b.status !== 'Completed' && b.status !== 'Cancelled';
    });
  });

  // A block's title is whatever human text it carries; the record id is not a
  // title. Server-side "None" strings and blanks both mean untitled, and an
  // untitled block is named by when it runs, not by its primary key.
  function blockTitle(b) {
    if (!b) return '';
    const clean = (v) => {
      const t = (v == null ? '' : String(v)).trim();
      return (!t || t === 'None' || t === 'null' || t === 'undefined') ? '' : t;
    };
    return (
      clean(b.task_subject) ||
      clean(b.work_item_label) ||
      clean(b.task) ||
      clean(b.deliverable_notes) ||
      clean(b.project_name) ||
      ('Untitled block ' + formatCleanTime(b.start_time)).trim()
    );
  }

  const todoPickerOpen = ref(false);
  const todoSearchQuery = ref('');
  const todoSearchInputRef = ref(null);
  const todoPickerContainerRef = ref(null);

  function toggleTodoPicker() {
    todoPickerOpen.value = !todoPickerOpen.value;
    if (todoPickerOpen.value) {
      todoSearchQuery.value = '';
      nextTick(() => {
        if (todoSearchInputRef.value && todoSearchInputRef.value.focus) {
          todoSearchInputRef.value.focus();
        }
      });
    }
  }

  const filteredOpenTodos = computed(() => {
    const q = (todoSearchQuery.value || '').trim().toLowerCase();
    if (!q) return openTodos.value;
    return openTodos.value.filter(t => {
      const subj = (t.subject || t.title || t.name || '').toLowerCase();
      const proj = (t.project_name || t.project || '').toLowerCase();
      const prio = (t.priority || '').toLowerCase();
      return subj.includes(q) || proj.includes(q) || prio.includes(q);
    });
  });

  const filteredPlannedBlocks = computed(() => {
    const q = (todoSearchQuery.value || '').trim().toLowerCase();
    if (!q) return todayPlannedBlocks.value;
    return todayPlannedBlocks.value.filter(b => {
      const title = (blockTitle(b) || '').toLowerCase();
      const proj = (b.project_name || b.project || '').toLowerCase();
      return title.includes(q) || proj.includes(q);
    });
  });

  const showCustomOption = computed(() => {
    const q = (todoSearchQuery.value || '').trim();
    if (!q) return false;
    const qLower = q.toLowerCase();
    const matchesTodo = openTodos.value.some(t => (t.subject || t.title || t.name || '').toLowerCase() === qLower);
    const matchesBlock = todayPlannedBlocks.value.some(b => (blockTitle(b) || '').toLowerCase() === qLower);
    return !matchesTodo && !matchesBlock;
  });

  function selectTodo(t) {
    if (!t) return;
    emit('unbind-block');
    const title = t.subject || t.title || t.name || 'Untitled ToDo';
    emit('update:notes', title);
    if (t.project) {
      emit('update:project', t.project);
    }
    emit('update:nature', 'Work');
    todoPickerOpen.value = false;
    todoSearchQuery.value = '';
  }

  function selectPlannedBlock(b) {
    if (!b) return;
    emit('bind-block', b);
    emit('update:notes', blockTitle(b));
    if (b.project) emit('update:project', b.project);
    if (b.task_nature) emit('update:nature', b.task_nature);
    todoPickerOpen.value = false;
    todoSearchQuery.value = '';
  }

  function selectCustomTitle() {
    const q = (todoSearchQuery.value || '').trim();
    if (!q) return;
    emit('unbind-block');
    emit('update:notes', q);
    todoPickerOpen.value = false;
    todoSearchQuery.value = '';
  }

  function onTodoSearchEnter() {
    if (filteredOpenTodos.value.length > 0) {
      selectTodo(filteredOpenTodos.value[0]);
    } else if (filteredPlannedBlocks.value.length > 0) {
      selectPlannedBlock(filteredPlannedBlocks.value[0]);
    } else if (showCustomOption.value) {
      selectCustomTitle();
    }
  }

  function clearSelectedTodo() {
    emit('unbind-block');
    emit('update:notes', '');
  }

  // The picker is one frappe-ui Combobox: open ToDos, today's planned blocks and, once
  // something new is typed, that text. What the session is for now stays selectable so the
  // field shows it.
  const todoKey = (t) => 'todo:' + (t.name || t.ref || t.subject || t.title);
  // Free notes can run to many lines with bullet or tick marks; the field shows one plain line
  const firstLine = (s) => {
    const line = String(s).split('\n').map(l => l.replace(/^[^\p{L}\p{N}]+/u, '').trim()).find(Boolean) || '';
    return line.length > 80 ? line.slice(0, 79).trimEnd() + '…' : line;
  };
  const workingOnOptions = computed(() => {
    const groups = [];
    const notes = String(props.trackerNotes || '').trim();
    const bound = props.trackerBoundBlock;
    const known = (bound && blockTitle(bound) === notes)
      || openTodos.value.some(t => (t.subject || t.title || t.name) === notes);
    if (notes && !known) groups.push({ group: 'Now', options: [{ value: 'current', label: firstLine(notes) }] });
    if (openTodos.value.length) groups.push({
      group: 'Open ToDos',
      options: openTodos.value.map(t => ({
        value: todoKey(t),
        label: t.subject || t.title || t.name,
        description: [t.project_name || t.project, t.due_date ? 'due ' + t.due_date : '', t.priority === 'High' ? 'High' : ''].filter(Boolean).join(' · ')
      }))
    });
    if (todayPlannedBlocks.value.length) groups.push({
      group: 'Planned today',
      options: todayPlannedBlocks.value.map(b => ({
        value: 'block:' + b.name,
        label: blockTitle(b),
        description: formatCleanTime(b.start_time) + '–' + formatCleanTime(b.end_time)
      }))
    });
    if (showCustomOption.value) groups.push({ group: 'New', options: [{ value: 'custom', label: todoSearchQuery.value.trim() }] });
    return groups;
  });
  const workingOnValue = computed(() => {
    const notes = String(props.trackerNotes || '').trim();
    if (!notes) return '';
    if (props.trackerBoundBlock && blockTitle(props.trackerBoundBlock) === notes) return 'block:' + props.trackerBoundBlock.name;
    const t = openTodos.value.find(x => (x.subject || x.title || x.name) === notes);
    return t ? todoKey(t) : 'current';
  });
  // A Combobox can emit its display text, so only a known option value acts
  function pickWorkingOn(v) {
    if (v === 'custom') return selectCustomTitle();
    if (typeof v !== 'string') return;
    if (v.startsWith('todo:')) return selectTodo(openTodos.value.find(t => todoKey(t) === v));
    if (v.startsWith('block:')) return selectPlannedBlock(todayPlannedBlocks.value.find(b => 'block:' + b.name === v));
  }
  // The Combobox's own search box: its text is what a new title would be
  function onWorkingOnInput(ev) {
    if (ev && ev.target && ev.target.tagName === 'INPUT') todoSearchQuery.value = ev.target.value;
  }

  function onDocumentClick(ev) {
    if (!todoPickerOpen.value) return;
    if (todoPickerContainerRef.value && !todoPickerContainerRef.value.contains(ev.target)) {
      todoPickerOpen.value = false;
    }
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onDocumentClick);
  });

  onUnmounted(() => {
    document.removeEventListener('pointerdown', onDocumentClick);
  });
  // Untitled blocks are named by when they run.
  function formatCleanTime(val) {
    if (!val) return '';
    const parts = String(val).trim().split(':');
    return parts.length >= 2 ? `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}` : String(val).trim();
  }


  return {
    openTodos,
    todayPlannedBlocks,
    blockTitle,
    todoPickerOpen,
    todoSearchQuery,
    todoSearchInputRef,
    todoPickerContainerRef,
    toggleTodoPicker,
    filteredOpenTodos,
    filteredPlannedBlocks,
    showCustomOption,
    selectTodo,
    selectPlannedBlock,
    selectCustomTitle,
    onTodoSearchEnter,
    clearSelectedTodo,
    onDocumentClick,
    workingOnOptions,
    workingOnValue,
    pickWorkingOn,
    onWorkingOnInput
  };
}
