import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 환경 변수에서 URL을 가져오도록 수정
const supabaseUrl = "https://jdubrjczdyqqtsppojgu.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww";

// 브라우저 환경인지 확인 (디버깅 목적으로만 사용)
const isBrowser = () => typeof window !== 'undefined';

// 싱글톤 인스턴스 관리를 위한 변수
let supabaseInstance: SupabaseClient | null = null;
let initializationAttempted = false; // 초기화 시도 여부 추적

/**
 * Supabase 클라이언트 인스턴스를 반환하는 함수 (싱글톤 패턴)
 * 클라이언트가 이미 존재하면 기존 인스턴스를 반환하고, 없으면 새로 생성
 */
const getSupabase = (): SupabaseClient | null => {
  // 이미 인스턴스가 있으면 그대로 반환
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // 이전에 초기화를 시도했지만 실패한 경우 재시도하지 않음
  if (initializationAttempted) {
    console.warn('이전 Supabase 클라이언트 초기화 실패, 재시도하지 않음');
    return null;
  }

  // 초기화 시도 상태 설정
  initializationAttempted = true;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL과 Anon Key가 설정되어 있지 않습니다.');
    return null;
  }
  
  try {
    const env = isBrowser() ? '브라우저' : '서버';
    console.log(`[Supabase] ${env} 환경에서 클라이언트 초기화 시작`);
    
    // 클라이언트 생성 시 옵션 추가하여 초기화
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    
    // 초기화 검증
    if (!supabaseInstance || !supabaseInstance.auth) {
      console.error('[Supabase] 클라이언트 초기화 실패');
      return null;
    }
    
    console.log('[Supabase] 클라이언트 초기화 성공');
    return supabaseInstance;
  } catch (error) {
    console.error('[Supabase] 클라이언트 초기화 중 오류 발생:', error);
    return null;
  }
};

// 지연 초기화를 위한 프록시 - 메서드 호출 시 자동으로 인스턴스 초기화
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop: string | symbol) => {
    const client = getSupabase();
    if (!client) {
      console.error(`[Supabase] 클라이언트 초기화 실패 (prop: ${String(prop)})`);
      return () => Promise.reject(new Error('Supabase 클라이언트 초기화 실패'));
    }
    
    return client[prop as keyof SupabaseClient];
  }
}); 