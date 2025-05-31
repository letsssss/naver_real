import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';

// ✅ Supabase 프로젝트 ID를 환경변수에서 동적으로 가져오기
function getProjectRef(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let projectRef = 'jdubrjczdyqqtsppojgu'; // 기본값 (fallback)
  
  if (supabaseUrl) {
    // URL에서 프로젝트 ID 추출: https://[PROJECT_ID].supabase.co
    const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch && urlMatch[1]) {
      projectRef = urlMatch[1];
    }
  }
  
  return projectRef;
}

const projectRef = getProjectRef();
const authCookie = `sb-${projectRef}-auth-token`;
const authStatusCookie = 'auth-status';

// ✅ 보호 경로 목록
const PROTECTED_ROUTES = [
  '/mypage',
  '/sell',
  '/cart',
  '/write-post',
  '/user-info',
  '/admin'
];

// ✅ 보호된 API 경로
const PROTECTED_API_ROUTES = [
  '/api/chat/init-room',
  '/api/notifications',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: { path: string; maxAge?: number; domain?: string; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' }) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: { path: string; domain?: string }) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          })
        },
      },
    }
  );

  await supabase.auth.getSession();

  return response;
}

// ✅ App Router용 matcher 설정
export const config = {
  matcher: [
    '/mypage/:path*',
    '/sell/:path*',
    '/cart/:path*',
    '/write-post/:path*',
    '/user-info/:path*',
    '/admin/:path*',
    '/api/chat/:path*',
    '/api/notifications/:path*'
  ],
}; 