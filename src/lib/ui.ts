// Shared Tailwind class strings, so forms and buttons look the same on every page.
// Inputs are 16px on phones (iOS zooms into anything smaller on focus).

export const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-white/70 bg-white/60 text-base sm:text-sm outline-none ' +
  'focus:border-gray-900 focus:bg-white/80 transition-colors placeholder:text-gray-400 disabled:opacity-60'

export const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-normal transition-all duration-200 ' +
  'disabled:opacity-50 disabled:pointer-events-none min-h-[44px] sm:min-h-[38px] px-4 py-2'

export const btnPrimary = `${buttonBase} bg-gray-900 text-white hover:bg-black active:scale-[0.98]`
export const btnSecondary = `${buttonBase} border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white active:scale-[0.98]`
export const btnGhost = `${buttonBase} text-gray-700 hover:bg-white/60`
export const btnDanger = `${buttonBase} border border-red-600 text-red-700 hover:bg-red-600 hover:text-white`
export const btnSmall =
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-xs px-3 py-2 min-h-[36px] transition-colors ' +
  'disabled:opacity-50 disabled:pointer-events-none'

export const chip = 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap'
export const accent = '#750014'

export const pageTitle = 'text-2xl sm:text-3xl font-light'
export const sectionTitle = 'text-lg sm:text-xl font-light'

/** Segmented control (tabs / filters). */
export const segment = (active: boolean) =>
  `px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors min-h-[40px] ${
    active ? 'bg-gray-900 text-white' : 'border border-white/70 bg-white/40 hover:bg-white/70'
  }`
