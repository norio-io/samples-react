import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { ReservationStatus } from '../../domain/types'
import { StatusOverridesContext, type StatusOverridesValue } from './statusOverridesContext'

export function ReservationStatusOverridesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, ReservationStatus>>({})

  const apply = useCallback((id: string, status: ReservationStatus) => {
    setOverrides((current) => ({ ...current, [id]: status }))
  }, [])

  const revert = useCallback((id: string) => {
    setOverrides((current) => {
      if (!(id in current)) return current
      const next = { ...current }
      delete next[id]
      return next
    })
  }, [])

  // 成功した場合は保持したままとする。モックAPI側の値と一致するため、
  // 以降の再取得でも同じ値が返り、表示が揺れない。
  const value = useMemo<StatusOverridesValue>(
    () => ({ overrides, apply, revert }),
    [overrides, apply, revert],
  )

  return <StatusOverridesContext.Provider value={value}>{children}</StatusOverridesContext.Provider>
}
