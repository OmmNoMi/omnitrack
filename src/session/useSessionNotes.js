import { ref, computed, watch, nextTick } from 'vue';

export function useSessionNotes(props, emit) {
  const localLineText = ref('');
  const lineInputRef = ref(null);
  const toolbarRef = ref(null);
  const activeToolIndex = ref(2); // Stop button is the default landing tab stop (index 2)
  // Each line must say what was done: OmniTrack Settings > Minimum Characters per Session Log Line
  const lineChars = computed(() => localLineText.value.trim().length);
  const lineTooShort = computed(() => lineChars.value < props.minLineChars);
  const lineHint = ref(false);
  watch(lineChars, (n) => { if (n >= props.minLineChars) lineHint.value = false; });
  // Older sessions stored lines with a tick or bullet in front; show the words only
  const plainLine = (l) => String(l).replace(/^[^\p{L}\p{N}]+/u, '');

  function autoGrowTextarea(e) {
    const el = (e && e.target) || lineInputRef.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  const activeRowIndex = ref(0);
  const notesListRef = ref(null);

  function focusRow(idx) {
    if (!props.sessionNotesList || !props.sessionNotesList.length) {
      focusLineInput();
      return;
    }
    const nextIdx = Math.max(0, Math.min(props.sessionNotesList.length - 1, idx));
    activeRowIndex.value = nextIdx;
    nextTick(() => {
      const list = notesListRef.value;
      if (list) {
        const rows = list.querySelectorAll('[data-log-row]');
        if (rows && rows[nextIdx]) {
          rows[nextIdx].focus();
        }
      }
    });
  }

  function focusRowDeleteBtn(idx) {
    const list = notesListRef.value;
    if (!list) return;
    const rows = list.querySelectorAll('[data-log-row]');
    if (rows && rows[idx]) {
      const btn = rows[idx].querySelector('[data-remove-line-btn]');
      if (btn) btn.focus();
    }
  }

  function onRowKeydown(ev, idx) {
    const total = (props.sessionNotesList || []).length;
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (idx > 0) {
        focusRow(idx - 1);
      }
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (idx < total - 1) {
        focusRow(idx + 1);
      } else {
        focusLineInput();
      }
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      focusRowDeleteBtn(idx);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      focusLineInput();
    } else if (ev.key === 'Enter' || ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      emit('remove-line', idx);
      nextTick(() => {
        const remaining = (props.sessionNotesList || []).length;
        if (!remaining) {
          focusLineInput();
        } else {
          focusRow(Math.min(idx, remaining - 1));
        }
      });
    }
  }

  function onRemoveBtnKeydown(ev, idx) {
    const total = (props.sessionNotesList || []).length;
    if (ev.key === 'ArrowLeft' || ev.key === 'Escape') {
      ev.preventDefault();
      focusRow(idx);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (idx > 0) focusRow(idx - 1);
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (idx < total - 1) focusRow(idx + 1);
      else focusLineInput();
    } else if (ev.key === 'Enter' || ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      emit('remove-line', idx);
      nextTick(() => {
        const remaining = (props.sessionNotesList || []).length;
        if (!remaining) {
          focusLineInput();
        } else {
          focusRow(Math.min(idx, remaining - 1));
        }
      });
    }
  }

  function handleTextareaKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitLine();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Tab from input line focuses directly on the Stop button in the toolbar
      e.preventDefault();
      focusStopButton();
    } else if (e.key === 'ArrowUp' && e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
      if (props.sessionNotesList && props.sessionNotesList.length > 0) {
        e.preventDefault();
        focusRow(props.sessionNotesList.length - 1);
      }
    }
  }

  function scrollNotesToBottom() {
    nextTick(() => {
      if (notesListRef.value) {
        notesListRef.value.scrollTop = notesListRef.value.scrollHeight;
      }
    });
  }

  watch(() => (props.sessionNotesList || []).length, () => {
    scrollNotesToBottom();
  }, { immediate: true });

  function submitLine() {
    const text = localLineText.value.trim();
    if (!text) return;
    if (lineTooShort.value) { lineHint.value = true; return; }
    emit('add-line', text);
    localLineText.value = '';
    if (lineInputRef.value) {
      lineInputRef.value.style.height = 'auto';
    }
    scrollNotesToBottom();
  }

  function onToolbarKey(ev) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(ev.key)) return;
    const bar = toolbarRef.value;
    if (!bar) return;
    const tools = [...bar.querySelectorAll('[data-session-tool]')];
    if (tools.length < 2) return;
    ev.preventDefault();

    const cur = Math.max(0, tools.findIndex(el => el === document.activeElement || el.contains(document.activeElement)));
    let next = cur;
    if (ev.key === 'ArrowLeft') next = (cur - 1 + tools.length) % tools.length;
    else if (ev.key === 'ArrowRight') next = (cur + 1) % tools.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = tools.length - 1;

    activeToolIndex.value = next;
    nextTick(() => {
      const target = tools[next];
      if (target) {
        target.focus();
      }
    });
  }

  function focusStopButton() {
    activeToolIndex.value = 2; // Stop button
    nextTick(() => {
      if (toolbarRef.value) {
        const tools = toolbarRef.value.querySelectorAll('[data-session-tool]');
        if (tools.length > 2) {
          tools[2].focus();
        }
      }
    });
  }

  function focusLineInput() {
    nextTick(() => {
      if (lineInputRef.value) {
        lineInputRef.value.focus();
      }
    });
  }

  return {
    localLineText,
    lineChars,
    lineTooShort,
    lineHint,
    plainLine,
    lineInputRef,
    toolbarRef,
    activeToolIndex,
    autoGrowTextarea,
    activeRowIndex,
    notesListRef,
    focusRow,
    focusRowDeleteBtn,
    onRowKeydown,
    onRemoveBtnKeydown,
    handleTextareaKey,
    scrollNotesToBottom,
    submitLine,
    onToolbarKey,
    focusStopButton,
    focusLineInput
  };
}
