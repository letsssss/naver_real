import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

// ✅ 자동으로 환경 변수 로딩 & 쿠키 기반 세션 연동
const supabase = createPagesBrowserClient<Database>({
  cookieOptions: {
    name: 'sb-auth-token',
    secure: false,      // 임시 테스트 목적
    sameSite: 'Lax',    // 더 관용적인 쿠키 전송
    path: '/'
    // domain: 제거
  },
});

export default supabase; 