"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase"
import Link from "next/link"

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string>("")
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient()
      
      // 인증 유저 가져오기
      const { data: userData } = await supabase.auth.getUser()
      
      if (!userData.user) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      
      setUser(userData.user)

      // 관리자 role 확인
      const { data: roleData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userData.user.id)
        .single()

      if (roleData?.role !== 'ADMIN') {
        alert('접근 권한이 없습니다.')
        router.push('/')
        return
      }
      
      setRole(roleData?.role || '')
      setLoading(false)
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">이지티켓 관리자 대시보드</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 수수료 관리 카드 */}
        <Link href="/admin/fee" className="block">
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition duration-200 p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-blue-100 rounded-full mr-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6 text-blue-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold">수수료 관리</h2>
            </div>
            <p className="text-gray-600">판매자들의 미납 수수료를 확인하고 납부 처리를 할 수 있습니다.</p>
            <div className="mt-4 text-blue-600 font-medium">
              관리하기 →
            </div>
          </div>
        </Link>
        
        {/* 신고 관리 카드 */}
        <Link href="/admin/reports" className="block">
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition duration-200 p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6 text-red-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold">신고 관리</h2>
            </div>
            <p className="text-gray-600">사용자들의 신고 목록을 확인하고 처리할 수 있습니다.</p>
            <div className="mt-4 text-red-600 font-medium">
              관리하기 →
            </div>
          </div>
        </Link>
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <p className="text-sm text-gray-600">
          관리자 계정: {user?.email} ({role})
        </p>
      </div>
    </div>
  )
}

