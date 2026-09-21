import { Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ReservationDetailPage } from '../pages/ReservationDetailPage'
import { ReservationListPage } from '../pages/ReservationListPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ReservationListPage />} />
        <Route path="reservations/:reservationId" element={<ReservationDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
