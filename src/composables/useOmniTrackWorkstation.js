import { useWorkstationShell } from "./useWorkstationShell.js";
import { useWorkstationIdentity } from "./useWorkstationIdentity.js";
import { useWorkstationStoreBindings } from "./useWorkstationStoreBindings.js";
import { useWorkstationDashboardBinding } from "./useWorkstationDashboardBinding.js";
import { useWorkstationSessionClock } from "./useWorkstationSessionClock.js";
import { useWorkstationPickers } from "./useWorkstationPickers.js";
import { useWorkstationShortcuts } from "./useWorkstationShortcuts.js";
import { useWorkstationApi } from "./useWorkstationApi.js";
import { useWorkstationAttendance } from "./useWorkstationAttendance.js";
import { useWorkstationPlannerState } from "./useWorkstationPlannerState.js";
import { useWorkstationPlannerDrag } from "./useWorkstationPlannerDrag.js";
import { useWorkstationPlannerSelect } from "./useWorkstationPlannerSelect.js";
import { useWorkstationFocusTasks } from "./useWorkstationFocusTasks.js";
import { useWorkstationPortal } from "./useWorkstationPortal.js";
import { useWorkstationEod } from "./useWorkstationEod.js";

/**
 * Composes the workstation from per-feature modules. Each one registers what
 * it owns on the shared `w` bag; the return value is the public surface that
 * App.vue provides to every view.
 */
export function useOmniTrackWorkstation() {
  const w = {};
  useWorkstationShell(w);
  useWorkstationIdentity(w);
  useWorkstationStoreBindings(w);
  useWorkstationDashboardBinding(w);
  useWorkstationSessionClock(w);
  useWorkstationPickers(w);
  useWorkstationShortcuts(w);
  useWorkstationApi(w);
  useWorkstationAttendance(w);
  useWorkstationPlannerState(w);
  useWorkstationPlannerDrag(w);
  useWorkstationPlannerSelect(w);
  useWorkstationFocusTasks(w);
  useWorkstationPortal(w);
  useWorkstationEod(w);

  return w;
}
