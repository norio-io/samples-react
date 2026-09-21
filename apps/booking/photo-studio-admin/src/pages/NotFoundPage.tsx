import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section>
      <div className="page-head">
        <h1 className="page-head__title">ページが見つかりません</h1>
      </div>
      <p>
        <Link to="/">予約一覧へ戻る</Link>
      </p>
    </section>
  )
}
