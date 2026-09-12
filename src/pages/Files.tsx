import React from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { ComingSoon } from '@/components/common/ComingSoon'

export default function Files() {
  return (
    <div>
      <PageHeader title="Files" subtitle="Project documents, contracts, assets and requirements." />
      <ComingSoon
        title="File storage is on its way"
        description="Soon you'll be able to attach contracts, assets, requirement docs and invoices directly to each project."
      />
    </div>
  )
}
