import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

// ✅ 자동으로 환경 변수 로딩 & 쿠키 기반 세션 연동
const supabase = createPagesBrowserClient<Database>();

export default supabase; 