'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase.types'

// 브라우저에서 사용할 Supabase 클라이언트 생성
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    // 브라우저 쿠키 옵션 설정
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  }
) 