import { useCallback, useEffect, useRef, useState } from 'react'

export const useElementSize = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const update = useCallback(() => {
    const node = ref.current
    if (node) {
      setSize({ width: node.clientWidth, height: node.clientHeight })
    }
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    update()
    const observer = new ResizeObserver(() => update())
    observer.observe(node)
    return () => observer.disconnect()
  }, [update])

  return { ref, size }
}
