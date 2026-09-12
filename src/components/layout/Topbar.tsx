import React from 'react'
import { VaultLockIndicator } from '@/components/vault/VaultLockIndicator'
import { GlobalSearch } from './GlobalSearch'

export function Topbar() {
  return (
    <header className="flex items-center h-14 border-b border-surface-400 px-4 md:px-6 gap-4 no-print">
      <GlobalSearch />
      <VaultLockIndicator />
    </header>
  )
}
