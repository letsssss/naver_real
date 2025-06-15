// lib/supabase.ts
'use client';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// 환경 변수 검증
const validateEnvVars = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Supabase 환경 변수가 설정되지 않았습니다:');
    console.error(`NEXT_PUBLIC_SUPABASE_URL: ${url ? '✅' : '❌'}`);
    console.error(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${key ? '✅' : '❌'}`);
    
    // 개발 환경에서만 하드코딩된 값 사용
    if (process.env.NODE_ENV === 'development') {
      console.warn('개발 환경: 하드코딩된 값으로 대체합니다.');
      return {
        url: 'https://your-project-url.supabase.co',
        key: 'your-anon-key'
      };
    }
    
    throw new Error('필수 Supabase 환경 변수가 누락되었습니다.');
  }

  return { url, key };
};

let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export const getSupabaseClient = async () => {
  if (!supabaseInstance) {
    const { url, key } = validateEnvVars();
    supabaseInstance = createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseInstance;
};

// 편의를 위한 기본 클라이언트 export
export const supabase = getSupabaseClient();
