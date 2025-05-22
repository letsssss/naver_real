import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

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
export function createRouteHandlerClient({ cookies }: { cookies: ReadonlyRequestCookies }) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookies.set(name, '', { ...options, maxAge: 0 });
        }
      }
    }
  );
}

/**
 * 서버 컴포넌트에서 사용할 Supabase 클라이언트를 생성합니다.
 * App Router(/app)의 Server Components나 Route Handlers에서 사용합니다.
 */
export function getServerClient() {
  const cookieStore = cookies();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            // Server Action에서는 설정 가능하지만 Server Component에서는 에러 발생
            cookieStore.set(name, value, options);
          } catch (error) {
            // Server Component에서 쿠키 설정 시 에러 무시
            // 미들웨어에서 처리됨
          }
        },
        remove(name, options) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            // Server Component에서 쿠키 삭제 시 에러 무시
          }
        },
      },
    }
  );
}

/**
 * 관리자 권한으로 Supabase에 접근하기 위한 클라이언트를 생성합니다.
 * 서버 측 API 경로에서만 사용해야 합니다.
 */
export function getServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name) {
          // 서비스 롤은 쿠키 사용 안함
          return undefined;
        },
        set(name, value, options) {
          // 서비스 롤은 쿠키 설정 안함
        },
        remove(name, options) {
          // 서비스 롤은 쿠키 삭제 안함
        },
      },
    }
  );
} 