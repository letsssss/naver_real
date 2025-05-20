import { createServerSupabaseClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic'; // ✅ 캐시 비활성화

export default async function AuthLogsPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ✅ 관리자 인증 (이메일 기준)
  if (!user || user.email !== 'wlstjd1590@naver.com') {
    redirect('/login');
  }

  // ✅ 인증 로그 불러오기
  const { data: logs, error } = await supabase
    .from('auth_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🛡️ 인증 로그</h1>

      {error && <p className="text-red-500">❌ 로그 불러오기 실패: {error.message}</p>}
      {!logs?.length && <p className="text-gray-500">아직 기록된 로그가 없습니다.</p>}

      {logs?.length > 0 && (
        <table className="w-full text-sm border border-gray-300">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-2 py-1 border">시간</th>
              <th className="px-2 py-1 border">이메일</th>
              <th className="px-2 py-1 border">유형</th>
              <th className="px-2 py-1 border">상태</th>
              <th className="px-2 py-1 border">에러 메시지</th>
              <th className="px-2 py-1 border">IP</th>
              <th className="px-2 py-1 border">User-Agent</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="px-2 py-1 border text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-2 py-1 border">{log.email}</td>
                <td className="px-2 py-1 border">{log.type}</td>
                <td className="px-2 py-1 border">{log.status}</td>
                <td className="px-2 py-1 border text-red-500">{log.error_message ?? '-'}</td>
                <td className="px-2 py-1 border">{log.ip_address ?? '-'}</td>
                <td className="px-2 py-1 border max-w-[200px] truncate text-gray-500">
                  {log.user_agent ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
} 