import { Route, Routes } from 'react-router-dom'
import { ReservationStatusOverridesProvider } from '../features/reservations/statusOverrides'
import { Layout } from './Layout'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ReservationCreatePage } from '../pages/ReservationCreatePage'
import { ReservationDetailPage } from '../pages/ReservationDetailPage'
import { ReservationListPage } from '../pages/ReservationListPage'

export function AppRoutes() {
  return (
    <ReservationStatusOverridesProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ReservationListPage />} />
          <Route path="reservations/new" element={<ReservationCreatePage />} />
          <Route path="reservations/:reservationId" element={<ReservationDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ReservationStatusOverridesProvider>
  )
}
