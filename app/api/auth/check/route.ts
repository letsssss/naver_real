import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';

/**
 * 인증 상태 확인 API 엔드포인트
 * @route GET /api/auth/check
 */
export async function GET() {
  try {
    // 쿠키 확인
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    // 인증 관련 쿠키만 필터링 (값은 보안을 위해 표시하지 않음)
    const authCookies = allCookies
      .filter(c => c.name.includes('supabase') || c.name.includes('auth'))
      .map(c => ({ name: c.name, exists: true }));
    
    // Supabase 클라이언트 생성
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set(name, value, options);
          },
          remove(name, options) {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );
    
    // 세션 확인
    const { data, error } = await supabase.auth.getSession();
    
    return NextResponse.json({ 
      cookieCount: allCookies.length,
      authCookies,
      hasCookies: authCookies.length > 0,
      hasSession: !!data.session,
      sessionError: error ? error.message : null
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || '인증 상태 확인 중 오류 발생'
    }, { status: 500 });
  }
} 