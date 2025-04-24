import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// ✅ 서버용 Supabase 클라이언트 - 최신 방식
export async function createServerSupabaseClient() {
  const cookieStore = cookies();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: { path: string; maxAge?: number; domain?: string; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' }) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: { path: string; domain?: string }) {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        }
      }
    }
  );
}

// ✅ 서버 액션이나 API 라우트에서 사용할 경우
export function createRouteHandlerClient() {
  const cookieStore = cookies();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: { path: string; maxAge?: number; domain?: string; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' }) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: { path: string; domain?: string }) {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        }
      }
    }
  );
} 