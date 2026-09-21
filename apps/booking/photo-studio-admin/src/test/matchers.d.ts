// @testing-library/jest-dom の型定義は Vitest 4 以前の Assertion<T> を前提としており、
// Vitest 5 の Assertion<R, T> とは型引数の数が異なるため宣言のマージが成立しない。
// Vitest が公開する拡張点である Matchers へ DOM マッチャーの型を合成する。
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<T, R> {}
}
