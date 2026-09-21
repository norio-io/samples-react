# samples-react

React + TypeScript の制作サンプル集。公開先は GitHub Pages。

## サンプル

| 制作種別 | サンプル | 公開URL |
|---|---|---|
| booking | 撮影スタジオ 予約管理画面（`apps/booking/photo-studio-admin/`） | https://norio-io.github.io/samples-react/booking/photo-studio-admin/ |

各サンプルは架空の題材であり、実在の企業・団体・個人とは関係しません。

## 開発

```sh
npm ci
npm run dev -w @samples-react/photo-studio-admin   # 開発サーバー
npm run typecheck
npm run lint
npm run test
npm run build                                      # dist/ へ出力
```

構成および開発上の取り決めは [CLAUDE.md](./CLAUDE.md) を参照。
