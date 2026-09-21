/** モックAPIの応答遅延（ms）。非同期処理の表示制御を確認できる程度の値とする。 */
export const API_LATENCY_MS = 300

/** 更新系操作が失敗する既定の確率。 */
export const DEFAULT_MUTATION_FAILURE_RATE = 0.2

let mutationFailureRate = DEFAULT_MUTATION_FAILURE_RATE

export function getMutationFailureRate(): number {
  return mutationFailureRate
}

/**
 * 更新系操作の失敗確率を差し替える。テストからは 0（常に成功）または
 * 1（常に失敗）を指定して結果を固定する。
 */
export function setMutationFailureRate(rate: number): void {
  if (rate < 0 || rate > 1) {
    throw new Error(`失敗確率は 0 以上 1 以下で指定してください: ${rate}`)
  }
  mutationFailureRate = rate
}

export function resetMutationFailureRate(): void {
  mutationFailureRate = DEFAULT_MUTATION_FAILURE_RATE
}

export function shouldFailMutation(): boolean {
  const rate = getMutationFailureRate()
  if (rate <= 0) return false
  if (rate >= 1) return true
  return Math.random() < rate
}

export function delay(ms: number = API_LATENCY_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
