import '@fontsource-variable/nunito'
import './site.css'

// Blocks fade in as they scroll into view, a little after one another within a row.
document.documentElement.classList.add('js')
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const el = entry.target as HTMLElement
      const siblings = [...(el.parentElement?.children ?? [])].filter((c) => c.classList.contains('reveal'))
      el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 70}ms`
      el.classList.add('in')
      observer.unobserve(el)
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
)
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear())
})
