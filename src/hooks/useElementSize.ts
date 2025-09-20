import { useCallback, useEffect, useRef, useState } from 'react'

const hasResizeObserver = () =>
  typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined'

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

    if (hasResizeObserver()) {
      const observer = new ResizeObserver(() => update())
      observer.observe(node)
      return () => observer.disconnect()
    }

    const handle = () => update()
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [update])

  return { ref, size }
}
