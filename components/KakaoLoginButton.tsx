"use client";

import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface KakaoLoginButtonProps {
  mode?: 'login' | 'signup';
  text?: string;
}

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';

export default function KakaoLoginButton({ mode = 'login', text }: KakaoLoginButtonProps) {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';

  async function signInWithKakao() {
    try {
      //console.log('🚀 카카오 로그인 시작');
      console.log(`현재 URL: ${window.location.origin}`);
      
      // === STEP 1: OAuth 요청 전 storage 상태 완전 스캔 ===
      console.log('📋 [BEFORE] OAuth 요청 전 storage 전체 스캔:');
      const beforeSession = Object.keys(sessionStorage);
      const beforeLocal = Object.keys(localStorage);
      
      console.log('🔍 [BEFORE] sessionStorage 모든 키:', beforeSession);
      console.log('🔍 [BEFORE] localStorage 모든 키:', beforeLocal);
      
      // localStorage 초기화 (PKCE verifier는 제외!)
      const keysToRemove = [
        'token', 'user', 'auth-token', 'auth-status', 
        'supabase-auth-token', 'supabase_token',
        'sb-access-token', 'sb-refresh-token'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // 이전 백업만 삭제 (원본은 보호)
      localStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
      sessionStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
      
      console.log('✅ 이전 인증 데이터 초기화 완료 (PKCE verifier 보호됨)');
      
      // === STEP 2: OAuth 요청 직전 storage 상태 재확인 ===
      console.log('📋 [BEFORE OAUTH] OAuth 직전 storage 상태:');
      const beforeOAuthSession = Object.keys(sessionStorage);
      const beforeOAuthLocal = Object.keys(localStorage);
      
      console.log('🔍 [BEFORE OAUTH] sessionStorage:', beforeOAuthSession);
      console.log('🔍 [BEFORE OAUTH] localStorage:', beforeOAuthLocal);
      
      // Supabase OAuth 요청
      console.log('📋 Supabase OAuth 요청 시작...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `https://www.easyticket82.com/auth/callback?redirect=${redirectTo}`,
          queryParams: {
            response_type: 'code'
          }
        },
      });
      
      if (error) {
        console.error('❌ 카카오 OAuth 요청 실패:', error);
        throw error;
      }
      
      // === STEP 3: OAuth 요청 직후 storage 상태 확인 ===
      console.log('📋 [AFTER OAUTH] OAuth 직후 storage 상태:');
      const afterOAuthSession = Object.keys(sessionStorage);
      const afterOAuthLocal = Object.keys(localStorage);
      
      console.log('🔍 [AFTER OAUTH] sessionStorage:', afterOAuthSession);
      console.log('🔍 [AFTER OAUTH] localStorage:', afterOAuthLocal);
      
      // === STEP 4: storage 변화 분석 ===
      const newSessionKeys = afterOAuthSession.filter(key => !beforeOAuthSession.includes(key));
      const newLocalKeys = afterOAuthLocal.filter(key => !beforeOAuthLocal.includes(key));
      
      console.log('🆕 [DIFF] OAuth 후 새로 생성된 sessionStorage 키:', newSessionKeys);
      console.log('🆕 [DIFF] OAuth 후 새로 생성된 localStorage 키:', newLocalKeys);
      
      // 새로 생성된 키들의 값 확인
      if (newSessionKeys.length > 0) {
        console.log('📋 새 sessionStorage 키들의 값:');
        newSessionKeys.forEach(key => {
          const value = sessionStorage.getItem(key);
          if (value) {
            const preview = value.length > 50 ? value.substring(0, 50) + '...' : value;
            console.log(`  - ${key}: ${preview}`);
          }
        });
      }
      
      if (newLocalKeys.length > 0) {
        console.log('📋 새 localStorage 키들의 값:');
        newLocalKeys.forEach(key => {
          const value = localStorage.getItem(key);
          if (value) {
            const preview = value.length > 50 ? value.substring(0, 50) + '...' : value;
            console.log(`  - ${key}: ${preview}`);
          }
        });
      }
      
      // === STEP 5: 잠시 대기 후 재확인 ===
      console.log('⏳ 200ms 대기 후 storage 재확인...');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const afterDelaySession = Object.keys(sessionStorage);
      const afterDelayLocal = Object.keys(localStorage);
      
      const delayNewSessionKeys = afterDelaySession.filter(key => !afterOAuthSession.includes(key));
      const delayNewLocalKeys = afterDelayLocal.filter(key => !afterOAuthLocal.includes(key));
      
      if (delayNewSessionKeys.length > 0 || delayNewLocalKeys.length > 0) {
        console.log('🆕 [DELAY] 대기 후 추가로 생성된 키들:');
        console.log('  - sessionStorage:', delayNewSessionKeys);
        console.log('  - localStorage:', delayNewLocalKeys);
      }
      
      // === STEP 6: PKCE verifier 검색 ===
      console.log('🔍 PKCE verifier 검색 시작...');
      
      // 이제 Supabase가 생성한 verifier를 찾아서 백업
      let verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
      console.log('🔍 표준 키로 sessionStorage 확인:', verifier ? `${verifier.substring(0, 10)}...` : 'null');
      
      if (!verifier) {
        verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
        console.log('🔍 표준 키로 localStorage 확인:', verifier ? `${verifier.substring(0, 10)}...` : 'null');
      }
      
      if (!verifier) {
        // 모든 가능한 verifier 키 패턴 확인
        const allPossibleKeys = [
          ...afterDelaySession,
          ...afterDelayLocal
        ].filter(key => 
          key.includes('verifier') || 
          key.includes('code') || 
          key.includes('pkce') ||
          key.includes('challenge')
        );
        
        console.log('🔍 verifier/code 관련 모든 키들:', allPossibleKeys);
        
        // 각 키의 값도 확인
        allPossibleKeys.forEach(key => {
          const sessionVal = sessionStorage.getItem(key);
          const localVal = localStorage.getItem(key);
          if (sessionVal) {
            console.log(`📋 sessionStorage[${key}]: ${sessionVal.substring(0, 20)}...`);
          }
          if (localVal) {
            console.log(`📋 localStorage[${key}]: ${localVal.substring(0, 20)}...`);
          }
          
          // 이 값이 verifier일 가능성이 있다면 사용
          if ((sessionVal || localVal) && !verifier) {
            const val = sessionVal || localVal;
            if (val.length > 40 && /^[A-Za-z0-9_-]+$/.test(val)) { // base64url 패턴
              console.log(`✅ 잠재적 verifier 발견: ${key}`);
              verifier = val;
            }
          }
        });
      }
      
      if (verifier) {
        // 원본 verifier가 있으면 백업 저장
        localStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, verifier);
        sessionStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, verifier);
        console.log('✅ PKCE verifier 백업 저장 완료:', verifier.substring(0, 10) + '...');
        console.log('✅ 원본 verifier 위치 확인:', {
          sessionStorage: !!sessionStorage.getItem(PKCE_VERIFIER_KEY),
          localStorage: !!localStorage.getItem(PKCE_VERIFIER_KEY)
        });
      } else {
        console.warn('⚠️ Supabase가 PKCE verifier를 생성하지 않은 것 같습니다.');
        console.log('📋 이는 다음을 의미할 수 있습니다:');
        console.log('  1. Supabase가 다른 키 이름을 사용함');
        console.log('  2. verifier가 메모리에만 저장됨');
        console.log('  3. 이 Supabase 버전은 PKCE를 사용하지 않음');
        
        // 수동 verifier 생성
        const manualVerifier = generateCodeVerifier();
        sessionStorage.setItem(PKCE_VERIFIER_KEY, manualVerifier);
        localStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, manualVerifier);
        sessionStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, manualVerifier);
        console.log('✅ 수동 verifier 생성 및 저장 완료:', manualVerifier.substring(0, 10) + '...');
      }
      
      // === STEP 7: 최종 상태 확인 ===
      console.log('📋 최종 storage 상태:');
      console.log('  - 원본 verifier (session):', !!sessionStorage.getItem(PKCE_VERIFIER_KEY));
      console.log('  - 원본 verifier (local):', !!localStorage.getItem(PKCE_VERIFIER_KEY));
      console.log('  - 백업 verifier (session):', !!sessionStorage.getItem(PKCE_VERIFIER_BACKUP_KEY));
      console.log('  - 백업 verifier (local):', !!localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY));
      
      console.log('✅ 카카오 OAuth 요청 성공 - 리다이렉트 중...');
    } catch (error) {
      console.error('❌ 카카오 로그인 실패:', error);
      alert('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    }
  }

  // PKCE verifier 수동 생성 함수
  function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  const buttonText = text || (mode === 'login' ? '카카오로 로그인' : '카카오로 회원가입');

  return (
    <button
      onClick={signInWithKakao}
      className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
      style={{ backgroundColor: '#FEE500' }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2C5.58 2 2 4.79 2 8.5c0 2.49 1.58 4.65 4 5.74l-.89 3.2c-.08.29.25.52.47.33L9.5 15.5c.17.01.33.01.5.01 4.42 0 8-2.79 8-6.5S14.42 2 10 2z"
          fill="currentColor"
        />
      </svg>
      {buttonText}
    </button>
  );
} 