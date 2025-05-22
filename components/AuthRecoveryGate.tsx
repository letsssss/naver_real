"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase"

export default function AuthRecoveryGate({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient()

    const recoverSessionFromHash = async () => {
      const hash = window.location.hash
      const hasToken = hash.includes("access_token") || hash.includes("refresh_token")

      if (hasToken) {
        // ✅ 해시에 토큰이 있다면 Supabase가 직접 복원하도록 유도
        console.log("🔑 인증 해시 감지됨 - 세션 복원 시도")
        const { data, error } = await supabase.auth.getSession()
        console.log("🔄 세션 복원 결과:", data?.session ? "성공" : "실패", error)
        
        // ✅ 해시 제거 (URL 깔끔하게)
        window.history.replaceState({}, document.title, window.location.pathname)
      }

      setIsReady(true)
    }

    recoverSessionFromHash()
  }, [])

  if (!isReady) {
    return null // 또는 로딩 UI
  }

  return <>{children}</>
} 