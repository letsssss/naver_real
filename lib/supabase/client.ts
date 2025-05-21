import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

// ✅ 자동으로 환경 변수 로딩 & 쿠키 기반 세션 연동
const supabase = createPagesBrowserClient<Database>({
  cookieOptions: {
    name: 'sb-auth-token',
    secure: true,                // ✅ HTTPS 필수
    sameSite: 'None',            // ✅ 크로스 도메인 대응
    path: '/',
    domain: '.easyticket82.com'  // ✅ 모든 서브도메인 포함
  },
});

export default supabase; 