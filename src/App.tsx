import { DevModeProvider } from './context/DevModeProvider'
import { Layout } from './components/Layout'

export default function App() {
  return (
    <DevModeProvider>
      <Layout />
    </DevModeProvider>
  )
}
