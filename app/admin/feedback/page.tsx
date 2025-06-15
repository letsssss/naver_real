"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"

interface Feedback {
  id: number
  content: string
  created_at: string
  status: 'pending' | 'reviewed' | 'resolved'
  admin_notes?: string
  updated_at: string
}

export default function FeedbackAdminPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchFeedbacks()
  }, [])

  const fetchFeedbacks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/feedback')
      if (!response.ok) {
        throw new Error('피드백을 불러오는데 실패했습니다.')
      }
      const data = await response.json()
      setFeedbacks(data.feedbacks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const updateFeedbackStatus = async (id: number, status: string, adminNotes?: string) => {
    try {
      const response = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status, admin_notes: adminNotes }),
      })

      if (!response.ok) {
        throw new Error('상태 업데이트에 실패했습니다.')
      }

      // 목록 새로고침
      fetchFeedbacks()
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'reviewed': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'reviewed': return '검토중'
      case 'resolved': return '완료'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">로딩 중...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">피드백 관리</h1>
        <p className="text-gray-600 mt-2">사용자 피드백을 확인하고 관리할 수 있습니다.</p>
      </div>

      <div className="grid gap-6">
        {feedbacks.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">아직 피드백이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          feedbacks.map((feedback) => (
            <Card key={feedback.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">피드백 #{feedback.id}</CardTitle>
                  <Badge className={getStatusColor(feedback.status)}>
                    {getStatusText(feedback.status)}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(feedback.created_at).toLocaleString('ko-KR')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">피드백 내용:</h4>
                    <p className="bg-gray-50 p-3 rounded-md">{feedback.content}</p>
                  </div>

                  {feedback.admin_notes && (
                    <div>
                      <h4 className="font-medium mb-2">관리자 메모:</h4>
                      <p className="bg-blue-50 p-3 rounded-md">{feedback.admin_notes}</p>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {feedback.status !== 'reviewed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateFeedbackStatus(feedback.id, 'reviewed')}
                      >
                        검토중으로 변경
                      </Button>
                    )}
                    {feedback.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateFeedbackStatus(feedback.id, 'resolved')}
                      >
                        완료로 변경
                      </Button>
                    )}
                    {feedback.status !== 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateFeedbackStatus(feedback.id, 'pending')}
                      >
                        대기중으로 변경
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
} 