import { useState } from 'react'
import { motion } from 'framer-motion'
import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cardVariants, pageVariants } from '../lib/animations'
import { SortableCard } from '../components/SortableCard'
import { useDevMode } from '../context/devModeContext'
import { CARD_COMPONENTS, CARD_ORDER, CARD_TITLES } from '../cards/registry'
import type { CardConfig, CardId } from '../types'

export function DashboardPage() {
  const { isDevMode } = useDevMode()

  const [cardsConfig, setCardsConfig] = useState<CardConfig[]>(() =>
    CARD_ORDER.map((id) => ({ id, title: CARD_TITLES[id], visible: true })),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setCardsConfig((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  const toggleCard = (id: CardId) => {
    setCardsConfig((items) =>
      items.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)),
    )
  }

  const visibleCards = cardsConfig.filter((card) => card.visible)
  const hiddenCards = cardsConfig.filter((card) => !card.visible)

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-7xl mx-auto"
    >
      {/* Re-add panel for hidden widgets */}
      {hiddenCards.length > 0 && (
        <motion.div
          variants={cardVariants}
          className="mb-8 backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-lg"
        >
          <h3 className="text-lg font-light mb-4">Available widgets</h3>
          <div className="flex flex-wrap gap-2">
            {hiddenCards.map((card) => (
              <button
                key={card.id}
                onClick={() => toggleCard(card.id)}
                className="px-4 py-2 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm"
              >
                + {card.title}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={visibleCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6" style={{ columnFill: 'balance' }}>
            {visibleCards.map((card) => {
              const CardBody = CARD_COMPONENTS[card.id]
              return (
                <SortableCard key={card.id} id={card.id} onHide={toggleCard} isDevMode={isDevMode}>
                  <CardBody />
                </SortableCard>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </motion.div>
  )
}
