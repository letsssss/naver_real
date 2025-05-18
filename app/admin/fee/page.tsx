'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

export default function AdminFeePage() {
  const [unpaid, setUnpaid] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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

      // 미납 수수료 조회
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('is_fee_paid', false)

      setUnpaid(data || [])
      setLoading(false)
    }

    fetchData()
  }, [])

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
      {unpaid.length === 0 ? (
        <p className="text-gray-600">모든 수수료가 납부되었습니다.</p>
      ) : (
        <ul className="space-y-4">
          {unpaid.map((item) => (
            <li
              key={item.id}
              className="border p-4 rounded-lg flex items-center justify-between"
            >
              <div>
                <p className="font-medium">구매 ID: {item.buyer_id}</p>
                <p className="text-sm text-gray-500">수수료: {item.fee_amount}원</p>
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