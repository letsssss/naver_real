import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// ✅ 서버용 Supabase 클라이언트 - 공식 문서 권장 방식
export async function createServerSupabaseClient() {
  const cookieStore = cookies();
  return createServerComponentClient<Database>({ cookies: () => cookieStore });
}

// ✅ 서버 액션이나 API 라우트에서 사용할 경우
export function createRouteHandlerClient() {
  const cookieStore = cookies();
  return createServerComponentClient<Database>({ cookies: () => cookieStore });
} 