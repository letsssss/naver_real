'use client'

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(query)
      setMatches(mediaQuery.matches)

      const handler = (event: MediaQueryListEvent) => {
        setMatches(event.matches)
      }

      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [query])

  // SSR 중에는 false 반환, 클라이언트에서 마운트된 후 실제 값 반환
  if (!mounted) {
    return false
  }

  return matches
}

// 편의 함수들
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)') 