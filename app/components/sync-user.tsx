"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase-client"

export function SyncUser() {
  useEffect(() => {
    const sync = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data.user

        if (!user) {
          console.log("🔍 로그인한 사용자가 없음")
          return
        }

        console.log("✅ 현재 로그인된 유저:", user)

        const { data: userData, error } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .maybeSingle()

        if (error) {
          console.error("❌ 사용자 조회 중 오류:", error.message)
          return
        }

        if (!userData) {
          const insertResult = await supabase.from("users").insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name ?? "",
            role: "USER",
          })

          if (insertResult.error) {
            console.error("❌ 사용자 등록 중 오류:", insertResult.error.message)
            return
          }

          console.log("✅ users 테이블에 유저 자동 등록됨")
        } else {
          console.log("✅ users 테이블에 이미 유저 있음")
        }
      } catch (err) {
        console.error("❌ 사용자 동기화 중 예외 발생:", err)
      }
    }

    sync()
  }, [])

  return null
} 