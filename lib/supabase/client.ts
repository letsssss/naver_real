import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

// 환경 변수에서 API URL과 ANON KEY 가져오기 (또는 하드코딩된 값 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

// 환경 변수 로깅 (비밀키는 부분적으로 마스킹)
console.log('[SUPABASE] URL이 설정되었나요?', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('[SUPABASE] ANON KEY가 설정되었나요?', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('[SUPABASE] 사용 중인 URL:', supabaseUrl);
console.log('[SUPABASE] ANON KEY 마스킹:', supabaseKey.substring(0, 10) + '...' + supabaseKey.substring(supabaseKey.length - 5));

// 클라이언트 싱글톤 인스턴스 생성
const supabase = createClientComponentClient<Database>({
  supabaseUrl,
  supabaseKey,
});

// 세션 초기화 함수
export async function initSession() {
  console.log('[SUPABASE] 세션 초기화 중...');
  try {
    // 현재 세션 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    
    // 세션 존재 여부 확인
    if (session) {
      // 세션 만료 시간 확인
      const expiresAt = session.expires_at || 0;
      const nowInSeconds = Math.floor(Date.now() / 1000);
      
      console.log('[SUPABASE] 유효한 세션이 있습니다:', session.user.id);
      console.log(`[SUPABASE] 세션 만료 시간: ${new Date(expiresAt * 1000).toLocaleString()} (${expiresAt - nowInSeconds}초 남음)`);
      
      // 만료 시간이 10분 이내인 경우 갱신
      if (expiresAt - nowInSeconds < 600) {
        console.log('[SUPABASE] 세션이 곧 만료됩니다. 새로고침을 시도합니다.');
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('[SUPABASE] 세션 새로고침 실패:', error.message);
          return session; // 갱신 실패해도 기존 세션 반환
        }
        
        console.log('[SUPABASE] 세션 새로고침 성공:', data.session?.user.id);
        return data.session;
      }
      
      return session;
    } else {
      console.log('[SUPABASE] 세션이 없거나 만료되었습니다. 세션 새로고침 시도 중...');
      
      // 세션 새로고침 시도
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[SUPABASE] 세션 새로고침 실패:', error.message);
        return null;
      }
      
      console.log('[SUPABASE] 세션 새로고침 성공:', data.session?.user.id);
      return data.session;
    }
  } catch (error) {
    console.error('[SUPABASE] 세션 초기화 중 오류 발생:', error);
    return null;
  }
}

export default supabase; 