import { DevModeProvider } from './context/DevModeProvider'
import { AuthProvider } from './context/AuthProvider'
import { Layout } from './components/Layout'

export default function App() {
  return (
    <DevModeProvider>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </DevModeProvider>
  )
}
