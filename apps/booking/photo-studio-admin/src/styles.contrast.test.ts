import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 文字と地のコントラスト比を検証する。
 *
 * 状態の色は淡色の地へ載せるため、素の色のままでは WCAG AA（4.5:1）へ
 * 届かない組み合わせが生じる。トークンの値だけでなく、規則が実際に
 * どの色を用いているかを読み取って検証する。
 */

/** WCAG 2.1 の達成基準 1.4.3（通常の文字）が求める比。 */
const AA_NORMAL_TEXT = 4.5

// テスト環境では CSS の取り込みを無効にしているため、ファイルとして読む。
const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'styles.css'), 'utf8')

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 行頭から始まる規則の宣言を読み出す。 */
function declarations(selector: string): Map<string, string> {
  const found = new RegExp(`^${escapeForRegExp(selector)}\\s*\\{([^}]*)\\}`, 'm').exec(CSS)
  const body = found?.[1]
  if (body === undefined) throw new Error(`規則 ${selector} が styles.css にありません`)

  const map = new Map<string, string>()
  for (const line of body.split(';')) {
    const [property, ...rest] = line.split(':')
    if (property === undefined || rest.length === 0) continue
    map.set(property.trim(), rest.join(':').trim())
  }
  return map
}

/** `var(--x)` の参照を辿り、色を16進6桁へ正規化する。 */
function resolveColor(value: string): string {
  const reference = /^var\(--([\w-]+)\)$/.exec(value)
  if (reference?.[1] !== undefined) {
    const found = new RegExp(`--${escapeForRegExp(reference[1])}:\\s*([^;]+);`).exec(CSS)
    const token = found?.[1]?.trim()
    if (token === undefined) throw new Error(`トークン --${reference[1]} がありません`)
    return resolveColor(token)
  }
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${[...value.slice(1)].map((digit) => digit + digit).join('')}`
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`色として解釈できません: ${value}`)
  return value.toLowerCase()
}

/** WCAG 2.1 の定義による相対輝度。 */
function luminance(color: string): number {
  const value = Number.parseInt(color.slice(1), 16)
  const toLinear = (channel: number) => {
    const ratio = channel / 255
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * toLinear((value >> 16) & 0xff) +
    0.7152 * toLinear((value >> 8) & 0xff) +
    0.0722 * toLinear(value & 0xff)
  )
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  const [lighter, darker] = a > b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 検証する規則。`behind` は、その規則が自ら地を持たない場合に
 * 実際の画面で背後となる色を指す。
 */
const CASES: readonly { name: string; selector: string; behind?: string }[] = [
  { name: 'ステータス（仮予約）', selector: '.badge--tentative' },
  { name: 'ステータス（確定）', selector: '.badge--confirmed' },
  { name: 'ステータス（完了）', selector: '.badge--completed' },
  { name: 'ステータス（キャンセル）', selector: '.badge--cancelled' },
  { name: '更新の失敗（詳細）', selector: '.detail__error' },
  { name: '条件のチップ', selector: '.chip' },
  { name: '表の見出し', selector: '.table thead th' },
  { name: '主操作のボタン', selector: '.button--primary' },
  { name: '取り消せない操作のボタン', selector: '.button--danger' },
  { name: '確認の実行ボタン', selector: '.button--danger-strong' },
  { name: '適用中の条件の見出し', selector: '.chips__legend', behind: 'var(--bg)' },
  { name: '画面の説明', selector: '.page-head__lead', behind: 'var(--bg)' },
  { name: '更新の完了（詳細）', selector: '.detail__notice', behind: 'var(--bg)' },
  { name: '脚注', selector: '.layout__footer', behind: 'var(--bg)' },
  { name: '入力の誤り（登録）', selector: '.field__error', behind: 'var(--surface)' },
  { name: '項目名（詳細）', selector: '.detail__items dt', behind: 'var(--surface)' },
  { name: '期間の区切り', selector: '.filters__dash', behind: 'var(--surface)' },
]

describe('文字と地のコントラスト', () => {
  it.each(CASES)('$name は WCAG AA を満たす', ({ selector, behind }) => {
    const rule = declarations(selector)

    const color = rule.get('color')
    expect(color, `${selector} に color がありません`).toBeDefined()
    if (color === undefined) return

    const background = rule.get('background-color') ?? behind
    expect(background, `${selector} の地を特定できません`).toBeDefined()
    if (background === undefined) return

    expect(contrast(resolveColor(color), resolveColor(background))).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    )
  })

  it('本文とリンクは地に対して十分な比を持つ', () => {
    // 本文の色と背景は :root に置いているため、トークンから直接確かめる。
    expect(contrast(resolveColor('var(--ink)'), resolveColor('var(--bg)'))).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    )
    expect(
      contrast(resolveColor('var(--accent)'), resolveColor('var(--surface)')),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })

  it('計算が WCAG の既知の値と一致する', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrast('#2563c9', '#2563c9')).toBeCloseTo(1, 5)
  })
})
