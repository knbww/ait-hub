import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useI18n } from '../context/i18nContext'
import { useNewsPhotoUrls } from '../hooks/useNews'

const GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2',
}

/** Full-screen viewer: arrows, swipes and the keyboard move between photos; Escape closes. */
function Lightbox({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const { t } = useI18n()
  const [index, setIndex] = useState(start)
  const [direction, setDirection] = useState(0)
  const downX = useRef<number | null>(null)

  const go = useCallback((step: number) => {
    setDirection(step)
    setIndex((i) => (i + step + urls.length) % urls.length)
  }, [urls.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [go, onClose])

  const onPointerDown = (e: ReactPointerEvent) => { downX.current = e.clientX }
  const onPointerUp = (e: ReactPointerEvent) => {
    if (downX.current === null) return
    const dx = e.clientX - downX.current
    downX.current = null
    if (urls.length > 1 && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  }

  const many = urls.length > 1
  const control = 'absolute p-3 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors'

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label={t('photos.viewer')}
      className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex items-center justify-center touch-pan-y select-none"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} onPointerDown={onPointerDown} onPointerUp={onPointerUp}
    >
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.img
          key={index}
          src={urls[index]}
          alt={t('photos.nOfM', { n: index + 1, m: urls.length })}
          className="max-w-[94vw] max-h-[86dvh] object-contain rounded-lg shadow-2xl"
          custom={direction}
          initial={{ opacity: 0, x: direction * 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -80 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </AnimatePresence>
      <button onClick={onClose} aria-label={t('common.close')} className={`${control} top-4 right-4`}>
        <X className="w-6 h-6" />
      </button>
      {many && (
        <>
          <button onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label={t('photos.prev')}
            className={`${control} left-3 top-1/2 -translate-y-1/2 hidden sm:block`}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); go(1) }} aria-label={t('photos.next')}
            className={`${control} right-3 top-1/2 -translate-y-1/2 hidden sm:block`}>
            <ChevronRight className="w-6 h-6" />
          </button>
          <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] text-sm text-white/80 tabular-nums">
            {index + 1} / {urls.length}
          </p>
        </>
      )}
    </motion.div>
  )
}

/** A post's photos (private bucket, signed links): one wide, or a grid of squares. */
export function PhotoGallery({ paths }: { paths: string[] }) {
  const { t } = useI18n()
  const { data: urls, isLoading } = useNewsPhotoUrls(paths)
  const [open, setOpen] = useState<number | null>(null)
  if (paths.length === 0) return null

  const list = paths.map((p) => urls?.[p]).filter((u): u is string => Boolean(u))
  const single = paths.length === 1
  const cell = single ? 'aspect-[4/3]' : 'aspect-square'

  if (isLoading) {
    return (
      <div className={`grid ${GRID[paths.length] ?? 'grid-cols-3'} gap-1.5 mt-3`} aria-busy="true">
        {paths.map((p) => <div key={p} className={`${cell} rounded-2xl bg-gray-900/5 animate-pulse`} />)}
      </div>
    )
  }
  if (list.length === 0) return null

  return (
    <>
      <div className={`grid ${GRID[list.length] ?? 'grid-cols-3'} gap-1.5 mt-3`}>
        {list.map((url, i) => (
          <button key={url} type="button" onClick={() => setOpen(i)}
            aria-label={t('photos.open', { n: i + 1, m: list.length })}
            className={`${cell} group relative overflow-hidden rounded-2xl bg-gray-900/5 focus-visible:outline-2 focus-visible:outline-gray-900`}>
            <img src={url} alt="" loading="lazy" decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      {/* In <body>: a frosted card would otherwise trap the fixed overlay inside itself. */}
      {createPortal(
        <AnimatePresence>
          {open !== null && <Lightbox urls={list} start={open} onClose={() => setOpen(null)} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
