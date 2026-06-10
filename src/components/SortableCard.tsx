import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { CardId } from '../types'

interface SortableCardProps {
  id: CardId
  children: ReactNode
  onHide: (id: CardId) => void
  isDevMode: boolean
}

export function SortableCard({ id, children, onHide, isDevMode }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative break-inside-avoid mb-6 w-full group">
      {/* Hover control panel */}
      <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Drag handle — only visible in Dev Mode */}
        {isDevMode && (
          <div
            {...attributes}
            {...listeners}
            className="p-2 rounded-xl bg-blue-600 text-white shadow-lg cursor-grab active:cursor-grabbing border border-blue-400"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Hide button — always available */}
        <button
          onClick={() => onHide(id)}
          className="p-2 rounded-xl bg-white shadow-lg border border-gray-200 text-red-500 hover:bg-red-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        className={`transition-all duration-300 ${
          isDevMode ? 'outline-dashed outline-2 outline-blue-400 outline-offset-4 rounded-3xl' : ''
        }`}
      >
        {children}
      </div>
    </div>
  )
}
