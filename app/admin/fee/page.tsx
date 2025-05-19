'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

export default function AdminFeePage() {
  const [unpaid, setUnpaid] = useState<any[]>([])
  const [filteredUnpaid, setFilteredUnpaid] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createBrowserClient()

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

      // 미납 수수료 조회 (판매자 정보 포함)
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          seller:seller_id (
            id,
            name,
            email
          )
        `)
        .eq('is_fee_paid', false)

      if (error) {
        console.error('미납 수수료 조회 오류:', error)
        alert('데이터 조회 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }

      console.log('미납 수수료 데이터:', data)
      setUnpaid(data || [])
      setFilteredUnpaid(data || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  // 검색 기능 구현
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUnpaid(unpaid)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = unpaid.filter(item => {
      const sellerName = (item.seller?.name || '').toLowerCase()
      const sellerEmail = (item.seller?.email || '').toLowerCase()
      const sellerId = (item.seller_id || '').toLowerCase()
      const feeAmount = String(item.fee_amount || '')

      return (
        sellerName.includes(query) || 
        sellerEmail.includes(query) || 
        sellerId.includes(query) ||
        feeAmount.includes(query)
      )
    })

    setFilteredUnpaid(filtered)
  }, [searchQuery, unpaid])

  const markAsPaid = async (id: string) => {
    try {
      // API를 통해 수수료 납부 처리
      const response = await fetch('/api/mark-fee-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: id }),
      })

      const result = await response.json()

      if (result.success) {
        // 성공 시 목록에서 제거
        setUnpaid((prev) => prev.filter((p) => p.id !== id))
        setFilteredUnpaid((prev) => prev.filter((p) => p.id !== id))
        alert('수수료 납부 처리가 완료되었습니다.')
      } else {
        alert('처리 실패: ' + result.message)
      }
    } catch (error) {
      console.error('수수료 납부 처리 중 오류:', error)
      alert('처리 중 오류가 발생했습니다.')
    }
  }

  if (loading) return <p>불러오는 중...</p>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">💰 관리자 수수료 납부 관리</h1>
      
      {/* 검색 폼 */}
      <div className="mb-6">
        <div className="relative">
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
            placeholder="판매자 이름, 이메일, ID 또는 금액으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {filteredUnpaid.length === 0 && unpaid.length > 0 
            ? '검색 결과가 없습니다.' 
            : `총 ${filteredUnpaid.length}개의 항목 표시 중`}
        </div>
      </div>

      {filteredUnpaid.length === 0 && unpaid.length === 0 ? (
        <p className="text-gray-600">모든 수수료가 납부되었습니다.</p>
      ) : (
        <ul className="space-y-4">
          {filteredUnpaid.map((item) => (
            <li
              key={item.id}
              className="border p-4 rounded-lg flex items-center justify-between"
            >
              <div>
                <p className="font-medium">
                  판매자: {item.seller?.name || '알 수 없음'} 
                  <span className="text-gray-500 ml-2 text-sm">({item.seller_id})</span>
                </p>
                <p className="text-sm text-gray-500">수수료: {item.fee_amount}원</p>
                {item.seller?.email && (
                  <p className="text-xs text-gray-400 mt-1">이메일: {item.seller?.email}</p>
                )}
              </div>
              <button
                onClick={() => markAsPaid(item.id)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                납부 처리
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
} 