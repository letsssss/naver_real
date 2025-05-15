import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 환경 변수에서 URL을 가져오도록 수정
const supabaseUrl = "https://jdubrjczdyqqtsppojgu.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww";

export const createClient = () => {
  const cookieStore = cookies();
  
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        // set과 remove는 서버 컴포넌트에서는 사용하지 않으므로 빈 함수로 구현
        set: (name, value, options) => {},
        remove: (name, options) => {},
      },
    }
  );
}; 