import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section>
      <h1>ページが見つかりません</h1>
      <p>
        <Link to="/">予約一覧へ戻る</Link>
      </p>
    </section>
  )
}
