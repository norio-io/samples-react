# CLAUDE.md

React / TypeScript の制作サンプル集。各サンプルは GitHub Pages で公開する。

## ディレクトリ構成

```
samples-react/
├── apps/
│   └── <制作種別>/
│       └── <業種の抽象名>[-<役割>]/
├── pages/                 # GitHub Pages のサイト直下へ配置する静的ファイル
├── scripts/
├── .github/workflows/
└── package.json           # npm workspaces（"workspaces": ["apps/*/*"]）
```

- `apps/` はソースの配置のみに用いる入れ物であり、公開URLには現れない。
- 役割の接尾辞は、公開画面では省略し、管理画面では `-admin` を付与する。
- この命名は静的サンプルのリポジトリ `norio-io/samples` と共通とする。同一題材のサンプルは、制作種別と業種の抽象名を一致させる。
  - 例: `norio-io/samples` の `booking/photo-studio/`（予約サイト）に対し、本リポジトリの `apps/booking/photo-studio-admin/`（管理画面）が対応する。

## 技術構成

| 項目 | 採用 |
|---|---|
| パッケージ管理 | npm workspaces |
| ビルド | Vite |
| 言語 | TypeScript（`strict`） |
| ルーティング | React Router |
| 静的解析 | ESLint |
| テスト | Vitest + Testing Library |

外部UIフレームワークおよびCSSフレームワークは使用しない。

## ビルドと公開

- 各サンプルの `vite.config.ts` の `base` は `/samples-react/<制作種別>/<業種の抽象名>[-<役割>]/` とする。
- ビルド成果物はリポジトリ直下の単一の `dist/<制作種別>/<業種の抽象名>[-<役割>]/` へ出力し、`dist/` 全体を GitHub Pages へ公開する。
- GitHub Pages はパスの書き換えに対応しない。物理ファイルの存在しないパスは 404 となるため、`pages/404.html` を `dist/404.html` として配置し、要求されたパスをクエリ文字列へ退避したうえで各サンプルの `index.html` へ引き渡し、読み込み後に history API でルーティングを復元する。
- 実行コマンド（リポジトリ直下）

  ```sh
  npm ci
  npm run typecheck
  npm run lint
  npm run test
  npm run build
  ```

## CI / CD

- プルリクエストに対し、型検査・静的解析・テスト・ビルドを実行する。`main` への統合時に GitHub Pages へ公開する。公開元は GitHub Actions とする。
- **CI のジョブ名 `typecheck` / `lint` / `test` / `build` は、Ruleset `main protection` が必須ステータスチェックとして名前で参照している。** ジョブ名を変更する場合は Ruleset 側の更新が必須であり、一致しない場合はプルリクエストがマージ不能となる。

## 開発の進め方

### コミットおよびタイトルの書式

`{絵文字} {prefix}: {説明}` とし、説明は日本語の終止形で記載する。コミット、プルリクエストのタイトル、イシューのタイトルのいずれも同一の書式を用いる。

| prefix | emoji | 用途 |
|---|---|---|
| feat | ✨ | 機能の追加、変更 |
| fix | 🐛 | バグ修正 |
| chore | 🛠️ | 設定、依存、ツール系 |
| refactor | ♻️ | 動作を変えないコード変更 |
| docs | 📚 | ドキュメント |
| test | ✅ | テストの追加、修正 |

- `.github/` などの開発インフラの変更は `chore`、`src/` への機能追加は `feat` とする。
- 書式の検査は CI に入れない。必須ステータスチェックの構成を変えないため。

### その他

- 原則として 1イシュー 1プルリクエストとする。実装上の依存により単独で検証できない場合に限り、1プルリクエストで複数のイシューを解決し、本文に `Closes #N` を列挙する。
- コミットメッセージおよびプルリクエストの記述言語は日本語とする。
- コミットには `Co-Authored-By` を残す。コミットメッセージおよびプルリクエストの本文には、セッションURLなど第三者にとって意味を持たない行を含めない。
- 各サンプルは架空の題材である。実在の企業・団体・個人とは関係しない旨を画面上に表示し、顧客名や連絡先などのデータにも実在の個人情報を含めない。
