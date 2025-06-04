"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const supabase = await getSupabaseClient()
        
        // 인증 유저 가져오기
        const { data: userData } = await supabase.auth.getUser()
        
        if (!userData.user) {
          router.push('/login')
          return
        }
        
        // 관리자 role 확인
        const { data: roleData, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('id', userData.user.id)
          .single()

        if (roleData?.role !== 'ADMIN') {
          alert('관리자 권한이 필요합니다.')
          router.push('/')
          return
        }
        
        setIsAdmin(true)
        setLoading(false)
      } catch (error) {
        router.push('/')
      }
    }

    checkAdminRole()
  }, [router])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return isAdmin ? <>{children}</> : null
} 