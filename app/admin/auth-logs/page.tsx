"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

interface AuthLog {
  id: string;
  type: string;
  email: string;
  status: 'success' | 'fail';
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AuthLogsPage() {
  const [logs, setLogs] = useState<AuthLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createBrowserClient()
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // 관리자 권한 검사
    if (!user || user.role !== "ADMIN") {
      router.push("/login")
      return
    }

    setLoading(true)
    supabase
      .from("auth_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error: fetchError }) => {
        setLoading(false)
        if (fetchError) {
          setError(fetchError.message)
        } else if (data) {
          setLogs(data as AuthLog[])
        }
      })
  }, [user, router])

  // 로그 새로고침 함수
  const refreshLogs = () => {
    setLoading(true)
    supabase
      .from("auth_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error: fetchError }) => {
        setLoading(false)
        if (fetchError) {
          setError(fetchError.message)
        } else if (data) {
          setLogs(data as AuthLog[])
        }
      })
  }

  return (
    <main className="p-8">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">📋 인증 시도 로그 (최근 100건)</h1>
        <button
          onClick={refreshLogs}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          disabled={loading}
        >
          {loading ? "로딩 중..." : "새로고침"}
        </button>
      </div>

      {loading && <div className="text-center py-4 bg-gray-50 rounded">로딩 중...</div>}
      {error && <div className="text-red-500 py-4 bg-red-50 rounded p-4">에러: {error}</div>}
      {!loading && !error && logs.length === 0 && (
        <div className="text-center py-4 bg-gray-50 rounded">로그 데이터가 없습니다.</div>
      )}

      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b text-left">
              <tr>
                <th className="p-3">시간</th>
                <th className="p-3">유형</th>
                <th className="p-3">이메일</th>
                <th className="p-3">상태</th>
                <th className="p-3">메시지</th>
                <th className="p-3">IP</th>
                <th className="p-3">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    {log.type === "signup" && <Badge className="bg-blue-100 text-blue-700">회원가입</Badge>}
                    {log.type === "login" && <Badge className="bg-purple-100 text-purple-700">로그인</Badge>}
                    {log.type !== "signup" && log.type !== "login" && <Badge>{log.type}</Badge>}
                  </td>
                  <td className="p-3">{log.email || "-"}</td>
                  <td className="p-3">
                    {log.status === "success" ? (
                      <Badge className="bg-green-100 text-green-700">성공</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">실패</Badge>
                    )}
                  </td>
                  <td className="p-3 text-gray-500 max-w-xs truncate" title={log.error_message || ""}>
                    {log.error_message || "-"}
                  </td>
                  <td className="p-3 text-gray-500">{log.ip_address || "-"}</td>
                  <td className="p-3 text-gray-400 truncate max-w-xs" title={log.user_agent || ""}>
                    {log.user_agent || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
} 