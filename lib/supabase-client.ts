import { createBrowserClient } from "@supabase/ssr";

// 하드코딩된 값 사용 (환경 변수 접근 문제 해결)
const SUPABASE_URL = 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

export const supabase = createBrowserClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
); 