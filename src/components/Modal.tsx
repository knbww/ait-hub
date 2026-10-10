import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useI18n } from '../context/i18nContext'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Wider panel for forms with several columns. */
  wide?: boolean
}

/** Glass dialog: a bottom sheet on phones, centred on larger screens. Escape, the backdrop
 * and the X close it. */
export function Modal({ title, onClose, children, wide = false }: ModalProps) {
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  // In <body>, so a frosted (backdrop-filter) parent can't trap the fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto bg-white/90 backdrop-blur-[40px] border-2 border-white/80 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-xl font-light">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 -m-2 rounded-lg text-gray-500 hover:text-gray-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
