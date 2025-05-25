'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

export default function DebugPage() {
  const [supabaseStatus, setSupabaseStatus] = useState('확인 중...');
  const [authStatus, setAuthStatus] = useState('확인 중...');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        addLog('Supabase 연결 테스트 시작...');
        // Supabase 연결 테스트
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (error) {
          setSupabaseStatus(`❌ 오류: ${error.message}`);
          addLog(`Supabase 오류: ${error.message}`);
        } else {
          setSupabaseStatus('✅ 연결 성공');
          addLog('Supabase 연결 성공');
        }
      } catch (err: any) {
        setSupabaseStatus(`❌ 예외: ${err.message}`);
        addLog(`Supabase 예외: ${err.message}`);
      }

      try {
        addLog('Auth 상태 확인 시작...');
        // Auth 상태 확인
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          setAuthStatus(`❌ Auth 오류: ${error.message}`);
          addLog(`Auth 오류: ${error.message}`);
        } else {
          setAuthStatus(session ? '✅ 로그인됨' : '❌ 로그인 안됨');
          addLog(session ? 'Auth: 로그인됨' : 'Auth: 로그인 안됨');
        }
      } catch (err: any) {
        setAuthStatus(`❌ Auth 예외: ${err.message}`);
        addLog(`Auth 예외: ${err.message}`);
      }
    };

    checkSupabase();
  }, []);

  const testKakaoLogin = async () => {
    try {
      addLog('카카오 로그인 테스트 시작...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            response_type: 'code'
          }
        }
      });
      
      if (error) {
        addLog(`카카오 로그인 오류: ${error.message}`);
      } else {
        addLog('카카오 로그인 요청 성공 - 리다이렉트 중...');
      }
    } catch (err: any) {
      addLog(`카카오 로그인 예외: ${err.message}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔍 고객 오류 진단 페이지</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-gray-50">
            <h2 className="text-xl font-semibold mb-2">환경변수</h2>
            <p>URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ 없음'}</p>
            <p>KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20) || '❌ 없음'}...</p>
          </div>

          <div className="p-4 border rounded-lg bg-gray-50">
            <h2 className="text-xl font-semibold mb-2">Supabase 연결</h2>
            <p>{supabaseStatus}</p>
          </div>

          <div className="p-4 border rounded-lg bg-gray-50">
            <h2 className="text-xl font-semibold mb-2">인증 상태</h2>
            <p>{authStatus}</p>
          </div>

          <div className="p-4 border rounded-lg bg-yellow-50">
            <h2 className="text-xl font-semibold mb-2">브라우저 정보</h2>
            <p className="text-sm">User Agent: {typeof window !== 'undefined' ? window.navigator.userAgent : 'Server'}</p>
            <p className="text-sm">URL: {typeof window !== 'undefined' ? window.location.href : 'Server'}</p>
            <p className="text-sm">쿠키 활성화: {typeof window !== 'undefined' ? (navigator.cookieEnabled ? '✅' : '❌') : 'Server'}</p>
          </div>

          <div className="p-4 border rounded-lg bg-blue-50">
            <h2 className="text-xl font-semibold mb-2">테스트</h2>
            <button 
              onClick={testKakaoLogin}
              className="bg-yellow-400 text-black px-4 py-2 rounded hover:bg-yellow-500"
            >
              🔍 카카오 로그인 테스트
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-green-50">
            <h2 className="text-xl font-semibold mb-2">실시간 로그</h2>
            <div className="bg-black text-green-400 p-3 rounded text-sm h-96 overflow-y-auto font-mono">
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
              {logs.length === 0 && <div>로그 대기 중...</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 border rounded-lg bg-red-50">
        <h2 className="text-xl font-semibold mb-2">📋 고객 리포트 양식</h2>
        <p className="text-sm text-gray-600">
          이 페이지의 스크린샷을 찍어서 개발자에게 보내주세요.<br/>
          특히 "환경변수", "Supabase 연결", "브라우저 정보" 부분이 중요합니다.
        </p>
      </div>
    </div>
  );
} 