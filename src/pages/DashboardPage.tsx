import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cardVariants, pageVariants } from '../lib/animations'
import { SortableCard } from '../components/SortableCard'
import { useDevMode } from '../context/devModeContext'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { supabase } from '../lib/supabase'
import { CARD_COMPONENTS, CARD_ORDER, CARD_TITLES } from '../cards/registry'
import type { CardConfig, CardId } from '../types'

type SavedLayoutItem = { id: CardId; visible: boolean }

/** Rebuild a full card config from a saved layout, tolerating cards that were
 * added or removed since the layout was saved. */
function buildConfig(saved?: SavedLayoutItem[]): CardConfig[] {
  const known = new Set<CardId>(CARD_ORDER)
  const seen = new Set<CardId>()
  const ordered: CardConfig[] = []
  for (const item of saved ?? []) {
    if (known.has(item.id) && !seen.has(item.id)) {
      ordered.push({ id: item.id, title: CARD_TITLES[item.id], visible: item.visible })
      seen.add(item.id)
    }
  }
  for (const id of CARD_ORDER) {
    if (!seen.has(id)) ordered.push({ id, title: CARD_TITLES[id], visible: true })
  }
  return ordered
}

export function DashboardPage() {
  const { isDevMode } = useDevMode()
  const { profile } = useAuth()
  const { t } = useI18n()
  const profileId = profile?.id

  const [cardsConfig, setCardsConfig] = useState<CardConfig[]>(() => buildConfig())

  // Load the signed-in member's saved layout.
  useEffect(() => {
    if (!supabase || !profileId) return
    const sb = supabase
    let active = true
    void (async () => {
      const { data } = await sb
        .from('dashboard_layouts')
        .select('layout')
        .eq('profile_id', profileId)
        .maybeSingle()
      if (active && data?.layout) setCardsConfig(buildConfig(data.layout as SavedLayoutItem[]))
    })()
    return () => {
      active = false
    }
  }, [profileId])

  // Persist layout changes for signed-in members (no-op when logged out).
  const persist = useCallback(
    (next: CardConfig[]) => {
      if (!supabase || !profileId) return
      void supabase.from('dashboard_layouts').upsert({
        profile_id: profileId,
        layout: next.map((c) => ({ id: c.id, visible: c.visible })),
        updated_at: new Date().toISOString(),
      })
    },
    [profileId],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cardsConfig.findIndex((item) => item.id === active.id)
    const newIndex = cardsConfig.findIndex((item) => item.id === over.id)
    const next = arrayMove(cardsConfig, oldIndex, newIndex)
    setCardsConfig(next)
    persist(next)
  }

  const toggleCard = (id: CardId) => {
    const next = cardsConfig.map((item) =>
      item.id === id ? { ...item, visible: !item.visible } : item,
    )
    setCardsConfig(next)
    persist(next)
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
      {/* Re-add panel for hidden widgets — layout mode only */}
      {isDevMode && hiddenCards.length > 0 && (
        <motion.div
          variants={cardVariants}
          className="mb-8 backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 shadow-lg"
        >
          <h3 className="text-lg font-light mb-4">{t('dashboard.availableWidgets')}</h3>
          <div className="flex flex-wrap gap-2">
            {hiddenCards.map((card) => (
              <button
                key={card.id}
                onClick={() => toggleCard(card.id)}
                className="px-4 py-2 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm"
              >
                + {t(card.title)}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
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
