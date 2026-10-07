// Material primary tab: a padded target with a state layer, an inset focus ring, and a 3px
// indicator under the active label. One look for every tab bar in the app.
export const TAB = 'relative h-10 px-3 inline-flex items-center gap-1.5 rounded-t-lg text-sm font-medium cursor-pointer transition-colors outline-none hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400';
export const INDICATOR = 'absolute inset-x-3 -bottom-px h-[3px] rounded-t-full bg-blue-600 dark:bg-blue-400';
export const COUNT = 'min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums inline-flex items-center justify-center';

export const tabTone = (selected) => selected
  ? 'text-blue-700 dark:text-blue-300'
  : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white';

export const countTone = (selected) => selected
  ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-gray-950'
  : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
