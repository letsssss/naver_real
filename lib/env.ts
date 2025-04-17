// lib/env.ts

// 클라이언트와 서버 모두에서 사용할 수 있는 환경변수 관리
export const SUPABASE_URL = 
  process.env.SUPABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  'https://jdubrjczdyqqtsppojgu.supabase.co';

export const SUPABASE_ANON_KEY = 
  process.env.SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

// 추가 환경변수
export const SUPABASE_SERVICE_ROLE_KEY = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU';

// 로깅 (개발 모드에서만)
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 env.ts에서 환경 변수 상태:');
  console.log(`- 서버전용 SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ 있음' : '❌ 없음'}`);
  console.log(`- 서버전용 SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ 있음' : '❌ 없음'}`);
  console.log(`- 클라이언트 NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 있음' : '❌ 없음'}`);
  console.log(`- 클라이언트 NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 있음' : '❌ 없음'}`);
  console.log(`- 사용 중인 SUPABASE_URL: ${SUPABASE_URL.substring(0, 15)}...`);
  console.log(`- 사용 중인 SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY.substring(0, 15)}...`);
} 