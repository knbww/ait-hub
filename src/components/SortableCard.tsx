import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { CardId } from '../types'
import { useI18n } from '../context/i18nContext'

interface SortableCardProps {
  id: CardId
  children: ReactNode
  onHide: (id: CardId) => void
  isDevMode: boolean
}

export function SortableCard({ id, children, onHide, isDevMode }: SortableCardProps) {
  const { t } = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isDevMode,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative break-inside-avoid mb-5 w-full">
      {/* Layout controls — drag + hide, only in layout mode (always visible: phones have no hover) */}
      {isDevMode && (
        <div className="absolute top-3 right-3 z-50 flex gap-2">
          <button
            {...attributes}
            {...listeners}
            aria-label={t('layout.drag')}
            className="p-2.5 rounded-xl bg-blue-600 text-white shadow-lg cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <button
            onClick={() => onHide(id)}
            aria-label={t('layout.hide')}
            className="p-2.5 rounded-xl bg-white shadow-lg border border-gray-200 text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={isDevMode ? 'outline-dashed outline-2 outline-blue-400 outline-offset-4 rounded-3xl' : ''}>
        {children}
      </div>
    </div>
  )
}
