import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';
import { cookies } from 'next/headers';

/**
 * 로그아웃 처리 API 엔드포인트
 * @route POST /api/auth/signout
 */
export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    
    console.log('🔒 로그아웃 요청 처리 중');
    
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
            try {
              cookieStore.set(name, value, options);
            } catch (error) {
              console.error('로그아웃 중 쿠키 설정 실패:', error);
            }
          },
          remove(name, options) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
            } catch (error) {
              console.error('로그아웃 중 쿠키 삭제 실패:', error);
            }
          },
        },
      }
    );
    
    // 세션 정보 가져오기 (로그 기록용)
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;
    
    // 로그아웃 실행
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('로그아웃 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    console.log('🔒 로그아웃 성공:', userEmail);
    return NextResponse.json({ success: true, message: '로그아웃 성공' });
  } catch (error: any) {
    console.error('로그아웃 처리 중 예외 발생:', error);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 