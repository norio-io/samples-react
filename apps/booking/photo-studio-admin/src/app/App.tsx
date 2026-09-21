import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'

export function App() {
  // GitHub Pages の公開パス（vite.config.ts の base）を基点とする。
  const basename = import.meta.env.BASE_URL

  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  )
}
