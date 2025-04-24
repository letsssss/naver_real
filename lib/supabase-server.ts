import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// ✅ Pages Router와 App Router 모두에서 사용 가능한 createServerSupabaseClient
export async function createServerSupabaseClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookies().set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookies().set(name, '', { ...options, maxAge: 0 });
        }
      }
    }
  );
}

// ✅ API 라우트에서 사용할 수 있는 createRouteHandlerClient
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
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        }
      }
    }
  );
} 