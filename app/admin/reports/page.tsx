'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import AdminOnly from '@/components/admin/AdminOnly'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Report {
  id: string
  reporter_id: string
  order_number: string
  reason: string
  type: string
  status: string
  created_at: string
  reporter?: {
    id: string
    name: string
    email: string
  }
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [filteredReports, setFilteredReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const router = useRouter()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const supabase = await getSupabaseClient()
      
      // 인증 유저 가져오기
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // 관리자 role 확인
      const { data: roleData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user?.id)
        .single()

      if (roleData?.role !== 'ADMIN') {
        alert('접근 권한이 없습니다.')
        router.push('/')
        return
      }

      // 신고 목록 조회 (신고자 정보 포함)
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:reporter_id (
            id,
            name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('신고 목록 조회 오류:', error)
        alert('데이터 조회 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }

      console.log('신고 목록 데이터:', data)
      setReports(data || [])
      setFilteredReports(data || [])
    } catch (error) {
      // 신고 목록 로딩 오류 처리
    } finally {
      setLoading(false)
    }
  }

  // 필터링 기능 구현 (검색어 + 상태 필터)
  useEffect(() => {
    let filtered = [...reports]
    
    // 상태 필터 적용
    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.status === statusFilter)
    }
    
    // 검색어 필터 적용
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(report => {
        const reporterId = (report.reporter_id || '').toLowerCase()
        const reporterName = (report.reporter?.name || '').toLowerCase()
        const orderNumber = (report.order_number || '').toLowerCase()
        const reason = (report.reason || '').toLowerCase()
        
        return (
          reporterId.includes(query) ||
          reporterName.includes(query) ||
          orderNumber.includes(query) ||
          reason.includes(query)
        )
      })
    }
    
    setFilteredReports(filtered)
  }, [searchQuery, statusFilter, reports])

  const updateReportStatus = async (reportId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const supabase = await getSupabaseClient()
      
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', reportId)

      if (error) {
        throw error
      }

      // 목록 새로고침
      fetchReports()
    } catch (error) {
      // 신고 상태 업데이트 오류 처리
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const ReportsContent = () => {
    if (loading) return <p>불러오는 중...</p>

    return (
      <>
        <h1 className="text-2xl font-bold mb-4">🚨 신고 관리</h1>
        
        {/* 검색 및 필터 */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="w-5 h-5 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                />
              </svg>
            </div>
            <input
              type="text"
              className="w-full py-2 pl-10 pr-4 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="신고자, 주문번호, 이유로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex-shrink-0">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
            >
              <option value="all">모든 상태</option>
              <option value="pending">대기중</option>
              <option value="approved">승인됨</option>
              <option value="rejected">거절됨</option>
            </select>
          </div>
        </div>
        
        <div className="mt-2 text-sm text-gray-500 mb-4">
          {filteredReports.length === 0 && reports.length > 0 
            ? '검색 결과가 없습니다.' 
            : `총 ${filteredReports.length}개의 신고 표시 중`}
        </div>

        {filteredReports.length === 0 && reports.length === 0 ? (
          <p className="text-gray-600">등록된 신고가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-100">
                <tr>
                  <th className="px-6 py-3">신고자</th>
                  <th className="px-6 py-3">주문번호</th>
                  <th className="px-6 py-3">유형</th>
                  <th className="px-6 py-3">사유</th>
                  <th className="px-6 py-3">상태</th>
                  <th className="px-6 py-3">신고일시</th>
                  <th className="px-6 py-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {report.reporter?.name || '알 수 없음'}
                      <div className="text-xs text-gray-500">{report.reporter_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{report.order_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      {report.type === 'transaction' ? '거래' : '게시글'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs overflow-hidden text-ellipsis">
                        {report.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        report.status === 'approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {report.status === 'pending' ? '대기중' : 
                         report.status === 'approved' ? '승인됨' : '거절됨'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {formatDate(report.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      {report.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => updateReportStatus(report.id, 'approved')}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => updateReportStatus(report.id, 'rejected')}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            거절
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  return (
    <AdminOnly>
      <AdminLayout>
        <ReportsContent />
      </AdminLayout>
    </AdminOnly>
  )
} 