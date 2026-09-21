// 各サンプルのビルド成果物が出力された単一の dist/ に対し、
// GitHub Pages のサイト直下へ配置する静的ファイルを複製する。
import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const repoRoot = new URL('../', import.meta.url)
const distDir = new URL('dist/', repoRoot)

await mkdir(distDir, { recursive: true })

for (const name of ['index.html', '404.html']) {
  await copyFile(
    fileURLToPath(new URL(`pages/${name}`, repoRoot)),
    fileURLToPath(new URL(name, distDir)),
  )
  console.log(`copied pages/${name} -> dist/${name}`)
}
