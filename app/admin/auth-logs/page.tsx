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
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // 디버깅용 토큰 확인 함수
  useEffect(() => {
    // 브라우저 콘솔에서 토큰 확인
    const checkTokens = () => {
      try {
        // 쿠키 확인
        console.log("🍪 쿠키:", document.cookie);
        
        // localStorage 확인
        const user = localStorage.getItem("user");
        console.log("📝 localStorage user:", user);
        
        // 스토리지 토큰 확인
        const token = localStorage.getItem("token");
        console.log("🔑 토큰 존재 여부:", !!token);
      } catch (e) {
        console.error("❌ 토큰 확인 오류:", e);
      }
    };
    
    checkTokens();
  }, []);

  useEffect(() => {
    // 디버깅 로그 추가
    console.log("🔍 Auth 상태:", { 
      user, 
      isAuthenticated: !!user, 
      role: user?.role,
      email: user?.email,
      authLoading
    });
    
    // 인증 로딩 중일 때는 리다이렉트하지 않음
    if (authLoading) {
      console.log("⏳ 인증 정보 로딩 중... 리다이렉트 지연");
      return;
    }
    
    // 권한 체크 - 로딩이 완료된 후에만 실행
    if (!user) {
      console.log("⛔ 사용자 정보 없음, 로그인으로 리다이렉트");
      router.push("/login");
      return;
    }
    
    // ADMIN 권한 체크 - 대소문자 구분 없이
    if (user.role?.toUpperCase() !== "ADMIN") {
      console.log(`⛔ 관리자 권한 없음 (${user.role}), 홈으로 리다이렉트`);
      router.push("/");
      return;
    }
    
    console.log("✅ 관리자 확인 완료, 데이터 로딩 시작");
    
    // 인증 체크가 완료된 후에만 데이터 로딩
    if (!authLoading && user && user.role?.toUpperCase() === "ADMIN") {
      setLoading(true);
      supabase
        .from("auth_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)
        .then(({ data, error: fetchError }) => {
          setLoading(false);
          if (fetchError) {
            console.error("❌ 데이터 로딩 오류:", fetchError);
            setError(fetchError.message);
          } else if (data) {
            console.log("✅ 로그 데이터 로딩 완료:", data.length, "건");
            setLogs(data as AuthLog[]);
          }
        });
    }
  }, [user, router, authLoading, supabase]);

  // 로그 새로고침 함수
  const refreshLogs = () => {
    console.log("🔄 로그 새로고침 시도");
    setLoading(true);
    supabase
      .from("auth_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error: fetchError }) => {
        setLoading(false);
        if (fetchError) {
          console.error("❌ 새로고침 오류:", fetchError);
          setError(fetchError.message);
        } else if (data) {
          console.log("✅ 새로고침 완료:", data.length, "건");
          setLogs(data as AuthLog[]);
        }
      });
  };

  // 인증 로딩 중일 때 로딩 UI 표시
  if (authLoading) {
    return (
      <main className="p-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-medium mb-2">🔄 인증 정보 확인 중...</h2>
            <p className="text-gray-500">잠시만 기다려주세요.</p>
          </div>
        </div>
      </main>
    );
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
  );
} 