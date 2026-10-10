import { MotionConfig } from 'framer-motion'
import { I18nProvider } from './context/I18nProvider'
import { DevModeProvider } from './context/DevModeProvider'
import { AuthProvider } from './context/AuthProvider'
import { Layout } from './components/Layout'

export default function App() {
  return (
    // Page and card animations follow the system "reduce motion" setting.
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <DevModeProvider>
          <AuthProvider>
            <Layout />
          </AuthProvider>
        </DevModeProvider>
      </I18nProvider>
    </MotionConfig>
  )
}
