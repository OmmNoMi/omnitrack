// The session popup's frame: the running session raised to full focus (SessionOverlay) and a
// work session added or edited by hand (WorkSessionEntry) open in the same one, so logging time
// always looks the same. Each adds its own z-index.
export const SESSION_BACKDROP = 'fixed inset-0 bg-gray-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto';
export const SESSION_PANEL = 'relative w-full max-w-4xl bg-white dark:bg-[#1E1F22] rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto';
// A solid button waiting for input: frappe-ui fades blue to blue-300 under white text (about
// 1.6:1), which reads as broken, not as "not yet". Grey with dark text says the same, legibly.
export const DISABLED_SOLID = 'disabled:!bg-gray-100 disabled:!text-gray-700 dark:disabled:!bg-gray-800 dark:disabled:!text-gray-300';
