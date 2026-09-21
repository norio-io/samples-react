import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="layout">
      <header className="layout__header">
        <Link className="layout__brand" to="/">
          撮影スタジオ 予約管理
        </Link>
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
      <footer className="layout__footer">
        <p>
          本サンプルは架空の題材であり、実在の企業・団体・個人とは一切関係しません。
        </p>
      </footer>
    </div>
  )
}
