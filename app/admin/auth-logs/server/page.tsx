import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

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

export default async function AdminLogsServerPage() {
  // 서버 컴포넌트에서 supabase 클라이언트 생성
  const supabase = createServerComponentClient({ cookies });
  
  // 현재 로그인 사용자 정보 가져오기
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 사용자 정보가 없거나 관리자가 아니면 리다이렉트
  // 여기서는 대소문자 구분없이 확인 (toUpperCase())
  if (!user || !user.user_metadata.role || user.user_metadata.role.toUpperCase() !== "ADMIN") {
    console.log("[서버] 관리자 권한 없음:", user?.email);
    redirect("/login");
  }

  // 관리자 권한이 확인되면 로그 데이터 가져오기
  const { data, error } = await supabase
    .from("auth_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  // 에러 발생시 표시
  if (error) {
    console.error("[서버] 데이터 로딩 오류:", error);
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-4">📋 인증 시도 로그 (최근 100건)</h1>
        <div className="text-red-500 py-4 bg-red-50 rounded p-4">
          에러: {error.message}
        </div>
      </main>
    );
  }

  // 데이터가 없는 경우
  if (!data || data.length === 0) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-4">📋 인증 시도 로그 (최근 100건)</h1>
        <div className="text-center py-4 bg-gray-50 rounded">
          로그 데이터가 없습니다.
        </div>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">📋 인증 시도 로그 (최근 100건) - 서버 컴포넌트</h1>
        <div className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded">
          {user.email} (관리자)
        </div>
      </div>

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
            {data.map((log: AuthLog) => (
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
      
      <div className="mt-4 text-sm text-gray-500">
        서버 컴포넌트로 렌더링된 페이지입니다. 인증 상태가 안정적으로 확인됩니다.
      </div>
    </main>
  );
} 