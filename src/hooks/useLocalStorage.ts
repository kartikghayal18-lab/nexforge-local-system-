import { useEffect, useState } from 'react'
import { storage } from '@/utils/storage'

export function useLocalStorage<T>(key: string, seed: T) {
  const [value, setValue] = useState<T>(() => {
    if (storage.has(key)) return storage.get<T>(key, seed)
    storage.set(key, seed)
    return seed
  })

  useEffect(() => {
    storage.set(key, value)
  }, [key, value])

  return [value, setValue] as const
}
