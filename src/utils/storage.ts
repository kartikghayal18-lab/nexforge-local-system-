// Small localStorage abstraction so the persistence layer can later be
// swapped for a real local database (e.g. SQLite via Tauri) without
// touching call sites.

const NAMESPACE = 'nexforge'

function key(name: string) {
  return `${NAMESPACE}:${name}`
}

export const storage = {
  get<T>(name: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key(name))
      if (!raw) return fallback
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },
  set<T>(name: string, value: T): void {
    try {
      localStorage.setItem(key(name), JSON.stringify(value))
    } catch {
      // ignore quota / serialization errors in phase 1
    }
  },
  has(name: string): boolean {
    return localStorage.getItem(key(name)) !== null
  },
  remove(name: string): void {
    localStorage.removeItem(key(name))
  },
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`
}
