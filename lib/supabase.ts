// lib/supabase.ts
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';

// 브라우저용 Supabase 클라이언트 싱글톤
let browserClient: ReturnType<typeof createClientComponentClient> | null = null;
let currentSubscription: { unsubscribe: () => void } | null = null;
let isInitialized = false;

// Admin 클라이언트 싱글톤
let adminClient: ReturnType<typeof createClient> | null = null;

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_STATE_KEY = 'supabase.auth.state';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';
const PKCE_AUTH_CODE_KEY = 'supabase.auth.code';
const PKCE_TIMESTAMP_KEY = 'supabase.auth.timestamp';
const PKCE_EXCHANGE_LOCK_KEY = 'supabase.auth.exchange_lock';
const PKCE_AUTH_COMPLETE_KEY = 'supabase.auth.complete';
const PKCE_SESSION_KEY = 'supabase.auth.session';
const PKCE_INIT_KEY = 'supabase.auth.initialized';

// 세션 변경 이벤트를 위한 커스텀 이벤트
const SESSION_CHANGE_EVENT = 'supabase.session.change';

// getSupabaseClient 함수 추가
export const getSupabaseClient = () => {
  if (typeof window === 'undefined') return null;
  return createBrowserClient();
};

// Admin 클라이언트 생성 함수 추가
export const createAdminClient = () => {
  if (typeof window !== 'undefined') {
    console.warn('Admin client should only be used on the server side');
    return null;
  }

  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Required environment variables are not set');
    }

    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClient;
};

// Admin 클라이언트 인스턴스 생성 및 내보내기
export const adminSupabase = typeof window === 'undefined' ? createAdminClient() : null;

// PKCE 초기화 함수
const initializePKCE = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const isInit = sessionStorage.getItem(PKCE_INIT_KEY);
    if (isInit === 'true') {
      //console.log('🔄 PKCE already initialized');
      return;
    }

    // 기존 verifier 확인
    const existingVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY) || 
                           localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY);

    if (!existingVerifier) {
      // 새로운 verifier 생성 (실제 구현에서는 암호학적으로 안전한 방법 사용)
      const newVerifier = generateCodeVerifier();
      console.log('🔑 Generated new verifier');
      
      savePKCEState(newVerifier, null);
    }

    sessionStorage.setItem(PKCE_INIT_KEY, 'true');
    console.log('✅ PKCE initialized');
  } catch (error) {
    console.error('❌ PKCE initialization failed:', error);
  }
};

// 코드 검증기 생성 함수
const generateCodeVerifier = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
};

// Base64URL 인코딩 함수
const base64URLEncode = (buffer: Uint8Array) => {
  return btoa(String.fromCharCode.apply(null, Array.from(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// PKCE 상태 저장 함수
const savePKCEState = (verifier: string | null, state: string | null, authCode?: string | null) => {
  if (typeof window === 'undefined') return;
  
  try {
    const timestamp = Date.now().toString();
    
    if (verifier) {
      // verifier가 유효한 형식인지 검증
      if (verifier.length < 43 || verifier.length > 128) {
        console.error('❌ Invalid verifier length:', verifier.length);
        return;
      }
      
      // base64url 형식 검증
      if (!/^[A-Za-z0-9_-]+$/.test(verifier)) {
        console.error('❌ Invalid verifier format');
        return;
      }

      // 이미 교환이 완료된 verifier인지 확인
      const sessionData = sessionStorage.getItem(PKCE_SESSION_KEY);
      if (sessionData) {
        try {
          const { usedVerifier } = JSON.parse(sessionData);
          if (usedVerifier === verifier) {
            console.log('⚠️ Verifier already used, skipping save');
            return;
          }
        } catch (e) {
          console.error('Session data parse error:', e);
          sessionStorage.removeItem(PKCE_SESSION_KEY);
        }
      }

      // 모든 스토리지에 verifier 저장
      try {
        sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
        localStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, verifier);
        localStorage.setItem(PKCE_TIMESTAMP_KEY, timestamp);
        
        // 쿠키에도 백업 (HttpOnly 아님)
        document.cookie = `${PKCE_VERIFIER_KEY}=${verifier}; path=/; max-age=300; SameSite=Strict`; // 5분
        
        console.log('✅ Verifier saved to all storages');
      } catch (e) {
        console.error('Failed to save verifier to some storages:', e);
      }
    }
    
    if (state) {
      sessionStorage.setItem(PKCE_STATE_KEY, state);
    }
    
    if (authCode) {
      // auth code가 유효한 UUID 형식인지 검증
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authCode)) {
        console.error('❌ Invalid auth code format');
        return;
      }

      // 이미 사용된 auth code인지 확인
      const sessionData = sessionStorage.getItem(PKCE_SESSION_KEY);
      if (sessionData) {
        const { usedAuthCode } = JSON.parse(sessionData);
        if (usedAuthCode === authCode) {
          console.log('⚠️ Auth code already used, skipping save');
          return;
        }
      }

      sessionStorage.setItem(PKCE_AUTH_CODE_KEY, authCode);
    }
  } catch (error) {
    console.error('PKCE 상태 저장 중 오류:', error);
  }
};

// PKCE 상태 복원 함수
const restorePKCEState = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    // 모든 스토리지에서 verifier 찾기
    let verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    
    // sessionStorage에 없으면 localStorage 확인
    if (!verifier) {
      verifier = localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY);
      if (verifier) {
        console.log('♻️ Restored verifier from localStorage');
        sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
      }
    }
    
    // 아직도 없으면 쿠키 확인
    if (!verifier) {
      const cookies = document.cookie.split(';');
      const verifierCookie = cookies.find(c => c.trim().startsWith(`${PKCE_VERIFIER_KEY}=`));
      if (verifierCookie) {
        verifier = verifierCookie.split('=')[1].trim();
        console.log('♻️ Restored verifier from cookie');
        sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
        localStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, verifier);
      }
    }

    const state = sessionStorage.getItem(PKCE_STATE_KEY);
    const authCode = sessionStorage.getItem(PKCE_AUTH_CODE_KEY);
    const exchangeLock = sessionStorage.getItem(PKCE_EXCHANGE_LOCK_KEY);
    
    // verifier가 없으면 백업에서 복원
    if (!verifier) {
      verifier = localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY);
      const timestamp = localStorage.getItem(PKCE_TIMESTAMP_KEY);
      
      if (verifier && timestamp) {
        const storedTime = parseInt(timestamp, 10);
        const now = Date.now();
        if (now - storedTime > 5 * 60 * 1000) { // 5분 초과
          console.log('⚠️ Backup verifier expired');
          localStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
          localStorage.removeItem(PKCE_TIMESTAMP_KEY);
          verifier = null;
        } else {
          console.log('♻️ Restored verifier from backup');
          sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
        }
      }
    }

    // 상태 유효성 검증
    if (verifier && !/^[A-Za-z0-9_-]+$/.test(verifier)) {
      console.error('❌ Invalid verifier format in storage');
      verifier = null;
    }
    
    if (authCode && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authCode)) {
      console.error('❌ Invalid auth code format in storage');
      sessionStorage.removeItem(PKCE_AUTH_CODE_KEY);
      return { verifier, state, authCode: null, exchangeLock };
    }

    return { verifier, state, authCode, exchangeLock };
  } catch (error) {
    console.error('PKCE 상태 복원 중 오류:', error);
    return { verifier: null, state: null, authCode: null, exchangeLock: null };
  }
};

// PKCE 상태 검증 함수
const validatePKCEState = () => {
  const state = restorePKCEState();
  if (!state.verifier) {
    console.error('❌ Missing code_verifier in both storages');
    return false;
  }
  return true;
};

// PKCE 상태 정리 함수
const cleanupPKCEState = (preserveVerifier = false, verifier?: string | null, authCode?: string | null) => {
  try {
    // 성공적으로 사용된 verifier와 auth code 기록
    if (verifier && authCode) {
      sessionStorage.setItem(PKCE_SESSION_KEY, JSON.stringify({
        usedVerifier: verifier,
        usedAuthCode: authCode,
        timestamp: Date.now()
      }));
    }

    if (!preserveVerifier) {
      sessionStorage.removeItem(PKCE_VERIFIER_KEY);
      localStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
      localStorage.removeItem(PKCE_TIMESTAMP_KEY);
    }
    sessionStorage.removeItem(PKCE_STATE_KEY);
    sessionStorage.removeItem(PKCE_AUTH_CODE_KEY);
    sessionStorage.removeItem(PKCE_EXCHANGE_LOCK_KEY);
    sessionStorage.setItem(PKCE_AUTH_COMPLETE_KEY, 'true');
  } catch (error) {
    console.error('PKCE 상태 정리 중 오류:', error);
  }
};

// PKCE 교환 잠금 설정
const setExchangeLock = () => {
  try {
    sessionStorage.setItem(PKCE_EXCHANGE_LOCK_KEY, Date.now().toString());
    console.log('🔒 Set exchange lock');
  } catch (error) {
    console.error('교환 잠금 설정 중 오류:', error);
  }
};

// PKCE 교환 잠금 확인
const checkExchangeLock = () => {
  try {
    const lock = sessionStorage.getItem(PKCE_EXCHANGE_LOCK_KEY);
    if (!lock) return false;
    
    const lockTime = parseInt(lock, 10);
    const now = Date.now();
    // 10초 이상 지난 잠금은 해제
    if (now - lockTime > 10000) {
      sessionStorage.removeItem(PKCE_EXCHANGE_LOCK_KEY);
      return false;
    }
    return true;
  } catch (error) {
    console.error('교환 잠금 확인 중 오류:', error);
    return false;
  }
};

const createBrowserClient = () => {
  if (typeof window === 'undefined') return null;
  
  if (!browserClient) {
    // PKCE 초기화 확인
    if (!isInitialized) {
      initializePKCE();
      isInitialized = true;
    }

    const { verifier, state, authCode } = restorePKCEState();
    
    // verifier 상태 로깅
    // console.log('🔍 PKCE State:', {
    //   hasVerifier: !!verifier,
    //   hasState: !!state,
    //   hasAuthCode: !!authCode,
    //   sessionVerifier: !!sessionStorage.getItem(PKCE_VERIFIER_KEY),
    //   localVerifier: !!localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY)
    // });
    
    // 이미 사용된 verifier/auth code 조합인지 확인
    const sessionData = sessionStorage.getItem(PKCE_SESSION_KEY);
    let isUsedCombination = false;
    
    if (sessionData && verifier && authCode) {
      try {
        const { usedVerifier, usedAuthCode } = JSON.parse(sessionData);
        isUsedCombination = usedVerifier === verifier && usedAuthCode === authCode;
      } catch (e) {
        console.error('Session data parse error:', e);
        sessionStorage.removeItem(PKCE_SESSION_KEY);
      }
    }

    // PKCE 상태 검증 (이미 사용된 조합이 아닌 경우에만)
    if (!isUsedCombination && verifier && authCode) {
      console.log('🔍 New PKCE state detected, proceeding with validation');
    }
    
    // 클라이언트 생성
    browserClient = createClientComponentClient({
      isSingleton: true
    });

    // 이전 구독 해제
    if (currentSubscription) {
      currentSubscription.unsubscribe();
    }

    // 이벤트 리스너 설정
    const lastEventTimestamp: { [key: string]: number } = {};
    const DEBOUNCE_INTERVAL = 100; // 100ms

    const { data: { subscription } } = browserClient.auth.onAuthStateChange(async (event, session) => {
      const now = Date.now();
      const lastTime = lastEventTimestamp[event] || 0;

      if (now - lastTime < DEBOUNCE_INTERVAL) {
        return;
      }

      lastEventTimestamp[event] = now;

      if (event === 'SIGNED_IN') {
        console.log('✅ 로그인 성공');
        if (session) {
          console.log('세션 정보:', session);
          
          // 세션 데이터 저장
          const sessionData = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            provider_token: session.provider_token,
            provider_refresh_token: session.provider_refresh_token
          };
          
          try {
            // localStorage에 저장
            localStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
            
            // 커스텀 이벤트 발생
            const sessionEvent = new CustomEvent(SESSION_CHANGE_EVENT, {
              detail: {
                event: 'SIGNED_IN',
                session: session
              }
            });
            window.dispatchEvent(sessionEvent);
            
            // 성공한 verifier/auth code 조합 기록
            cleanupPKCEState(true, verifier, authCode);
          } catch (error) {
            console.error('세션 저장 중 오류:', error);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('❌ 로그아웃됨');
        // localStorage에서 세션 제거
        localStorage.removeItem('supabase.auth.token');
        
        // 커스텀 이벤트 발생
        const sessionEvent = new CustomEvent(SESSION_CHANGE_EVENT, {
          detail: {
            event: 'SIGNED_OUT',
            session: null
          }
        });
        window.dispatchEvent(sessionEvent);
        
        cleanupPKCEState();
        sessionStorage.removeItem(PKCE_SESSION_KEY);
        sessionStorage.removeItem(PKCE_AUTH_COMPLETE_KEY);
      }
    });

    currentSubscription = subscription;
  }

  return browserClient;
};

// 세션 이벤트 리스너 등록 함수
const onSessionChange = (callback: (session: any) => void) => {
  if (typeof window === 'undefined') return () => {};
  
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };
  
  window.addEventListener(SESSION_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SESSION_CHANGE_EVENT, handler);
};

// 기본 클라이언트 인스턴스 생성
export const supabase = createBrowserClient();

// Exports
export { createBrowserClient, onSessionChange };
export default supabase;
