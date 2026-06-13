import { I18nProvider } from './context/I18nProvider'
import { DevModeProvider } from './context/DevModeProvider'
import { AuthProvider } from './context/AuthProvider'
import { Layout } from './components/Layout'

export default function App() {
  return (
    <I18nProvider>
      <DevModeProvider>
        <AuthProvider>
          <Layout />
        </AuthProvider>
      </DevModeProvider>
    </I18nProvider>
  )
}
