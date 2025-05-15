import { createClient as createClientOriginal } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// 환경 변수에서 URL을 가져오도록 수정
const supabaseUrl = "https://jdubrjczdyqqtsppojgu.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww";

export const createClient = () => {
  const cookieStore = cookies();
  
  return createClientOriginal(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // 서버 컴포넌트에서는 쿠키를 직접 지정해야 함
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      }
    }
  });
}; 