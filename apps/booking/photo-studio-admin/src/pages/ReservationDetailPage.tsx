import { useParams } from 'react-router-dom'

export function ReservationDetailPage() {
  const { reservationId } = useParams()

  return (
    <section>
      <h1>予約詳細</h1>
      <p>予約ID: {reservationId}</p>
      <p>詳細およびステータス更新の画面は後続のイシューで実装する。</p>
    </section>
  )
}
