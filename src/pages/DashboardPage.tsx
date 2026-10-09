import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Info } from 'lucide-react'
import { cardVariants, pageVariants } from '../lib/animations'
import { SortableCard } from '../components/SortableCard'
import { GlassCard } from '../components/GlassCard'
import { useDevMode } from '../context/devModeContext'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { supabase } from '../lib/supabase'
import { useMemberPrivate } from '../hooks/useManage'
import { CARD_COMPONENTS, CARD_TITLES, MEMBER_CARDS, STAFF_CARDS } from '../cards/registry'
import type { CardConfig, CardId } from '../types'

type SavedLayoutItem = { id: CardId; visible: boolean }

/** Rebuild the card list from a saved layout, tolerating cards added or removed since. */
function buildConfig(allowed: CardId[], saved?: SavedLayoutItem[]): CardConfig[] {
  const known = new Set(allowed)
  const seen = new Set<CardId>()
  const ordered: CardConfig[] = []
  for (const item of saved ?? []) {
    if (known.has(item.id) && !seen.has(item.id)) {
      ordered.push({ id: item.id, title: CARD_TITLES[item.id], visible: item.visible })
      seen.add(item.id)
    }
  }
  for (const id of allowed) {
    if (!seen.has(id)) ordered.push({ id, title: CARD_TITLES[id], visible: true })
  }
  return ordered
}

/** Nudges for accounts that are missing something the club needs. */
function ProfilePrompts() {
  const { t } = useI18n()
  const { profile, isStaff } = useAuth()
  const priv = useMemberPrivate(profile?.id)
  if (!profile) return null
  const prompts: { text: string; to: string; action: string }[] = []
  if (!profile.track_id && !isStaff) prompts.push({ text: t('prompt.track'), to: '/profile#track', action: t('prompt.trackAction') })
  if (!profile.grade && !isStaff) prompts.push({ text: t('prompt.grade'), to: '/profile', action: t('prompt.profileAction') })
  if (priv.data && priv.data.photo_consent === null) prompts.push({ text: t('prompt.photo'), to: '/profile#photo', action: t('prompt.profileAction') })
  if (!prompts.length) return null
  return (
    <GlassCard className="mb-6 !bg-amber-50/60">
      <ul className="space-y-2">
        {prompts.map((p) => (
          <li key={p.text} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="flex-1 min-w-[12rem]">{p.text}</span>
            <Link to={p.to} className="underline">{p.action}</Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}

export function DashboardPage() {
  const { isDevMode } = useDevMode()
  const { profile, isStaff } = useAuth()
  const { t } = useI18n()
  const profileId = profile?.id
  const allowed = isStaff ? STAFF_CARDS : MEMBER_CARDS

  const [saved, setSaved] = useState<SavedLayoutItem[] | undefined>()
  const cardsConfig = buildConfig(allowed, saved)

  useEffect(() => {
    if (!supabase || !profileId) return
    let active = true
    void supabase
      .from('dashboard_layouts')
      .select('layout')
      .eq('profile_id', profileId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.layout) setSaved(data.layout as SavedLayoutItem[])
      })
    return () => {
      active = false
    }
  }, [profileId])

  const persist = useCallback(
    (next: CardConfig[]) => {
      const layout = next.map((c) => ({ id: c.id, visible: c.visible }))
      setSaved(layout)
      if (!supabase || !profileId) return
      void supabase.from('dashboard_layouts').upsert({
        profile_id: profileId,
        layout,
        updated_at: new Date().toISOString(),
      })
    },
    [profileId],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cardsConfig.findIndex((item) => item.id === active.id)
    const newIndex = cardsConfig.findIndex((item) => item.id === over.id)
    persist(arrayMove(cardsConfig, oldIndex, newIndex))
  }

  const toggleCard = (id: CardId) =>
    persist(cardsConfig.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)))

  const visibleCards = cardsConfig.filter((card) => card.visible)
  const hiddenCards = cardsConfig.filter((card) => !card.visible)
  const firstName = profile?.full_name.split(/\s+/)[0] ?? ''

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-7xl mx-auto">
      <motion.h1 variants={cardVariants} className="text-2xl sm:text-3xl font-light mb-5 px-1">
        {t('dashboard.hello', { name: firstName })}
      </motion.h1>

      <ProfilePrompts />

      {isDevMode && hiddenCards.length > 0 && (
        <GlassCard className="mb-6">
          <h2 className="text-lg font-light mb-3">{t('dashboard.hiddenCards')}</h2>
          <div className="flex flex-wrap gap-2">
            {hiddenCards.map((card) => (
              <button key={card.id} onClick={() => toggleCard(card.id)}
                className="px-4 py-2 border border-gray-900 rounded-xl text-sm hover:bg-gray-900 hover:text-white transition-colors">
                + {t(card.title)}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="columns-1 md:columns-2 xl:columns-3 gap-5" style={{ columnFill: 'balance' }}>
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
