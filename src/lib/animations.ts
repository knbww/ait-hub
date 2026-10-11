import type { Variants } from 'framer-motion'

// One motion language for the whole Hub: a page fades in and its glass cards follow one after
// another, rising a little; leaving a page is a quick fade so navigation never waits on it.
// Reduced-motion users get none of it (MotionConfig in App).

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.2,
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.12,
    },
  },
}

export const cardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 14,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 32,
    },
  },
}
