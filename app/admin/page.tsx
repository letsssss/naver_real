"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"
import AdminLayout from "@/components/admin/AdminLayout"
import AdminOnly from "@/components/admin/AdminOnly"
import { Button } from "@/components/ui/button"

export default function AdminPage() {
  const { user } = useAuth()
  const [role, setRole] = useState<string>("")
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const supabase = await getSupabaseClient()
        
        // 관리자 통계 데이터를 가져오는 로직 추가
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .limit(10)

        if (error) {
          throw error
        }

        setStats(data)
      } catch (error) {
        // 통계 데이터 로딩 오류 처리
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchAdminStats()
    }
  }, [user])

  const DashboardContent = () => {
    return (
      <>
        <h1 className="text-2xl font-bold mb-6">대시보드</h1>
        
        {/* 상태 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 미처리 신고 카드 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">미처리 신고</p>
                <h3 className="text-2xl font-bold">{stats?.length || 0}</h3>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
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
            </div>
            <div className="mt-4">
              <Link 
                href="/admin/reports?status=pending" 
                className="text-sm text-blue-600 hover:underline"
              >
                자세히 보기 →
              </Link>
            </div>
          </div>
          
          {/* 미납 수수료 카드 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">미납 수수료</p>
                <h3 className="text-2xl font-bold">{stats?.length || 0}</h3>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
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
            </div>
            <div className="mt-4">
              <Link 
                href="/admin/fee" 
                className="text-sm text-blue-600 hover:underline"
              >
                자세히 보기 →
              </Link>
            </div>
          </div>
          
          {/* 총 사용자 카드 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">사용자</p>
                <h3 className="text-2xl font-bold">{stats?.length || 0}</h3>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6 text-green-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" 
                  />
                </svg>
              </div>
            </div>
          </div>
          
          {/* 총 거래 카드 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">총 거래</p>
                <h3 className="text-2xl font-bold">{stats?.length || 0}</h3>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6 text-purple-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" 
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* 메뉴 카드 섹션 */}
        <h2 className="text-lg font-semibold mb-4">관리자 기능</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 수수료 관리 카드 */}
          <Link href="/admin/fee" className="block">
            <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition duration-200 p-6 border border-gray-200">
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
            <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition duration-200 p-6 border border-gray-200">
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
            관리자: {user?.email} ({role})
          </p>
        </div>
      </>
    )
  }

  return (
    <AdminOnly>
      <AdminLayout>
        <DashboardContent />
      </AdminLayout>
    </AdminOnly>
  )
}

