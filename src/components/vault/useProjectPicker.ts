import { useEffect, useState } from 'react'
import { coreApi } from '@/data/coreClient'
import type { ProjectFull } from '@/data/coreTypes'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidProjectId(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id)
}

/**
 * Resolves which project a vault-add modal should attach a new record to.
 * - When `projectId` prop is already given (opened from a project-scoped
 *   page), that id is used as-is and no picker is shown.
 * - When it's null (opened from Dashboard/Secrets/Passwords "global" quick
 *   actions), fetches the project list so the user must pick one before
 *   they can submit.
 */
export function useProjectPicker(projectId: string | null) {
  const [projects, setProjects] = useState<ProjectFull[]>([])
  const [loading, setLoading] = useState(projectId === null)
  const [selected, setSelected] = useState<string>(projectId ?? '')

  useEffect(() => {
    if (projectId !== null) {
      setSelected(projectId)
      return
    }
    let cancelled = false
    setLoading(true)
    coreApi
      .projectsList()
      .then((rows) => { if (!cancelled) setProjects(rows) })
      .catch(() => { if (!cancelled) setProjects([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  const needsPicker = projectId === null
  const resolvedProjectId = needsPicker ? selected : projectId
  const noProjects = needsPicker && !loading && projects.length === 0

  return {
    needsPicker,
    loading,
    projects,
    selected,
    setSelected,
    resolvedProjectId,
    noProjects,
    canSubmit: isValidProjectId(resolvedProjectId),
  }
}
