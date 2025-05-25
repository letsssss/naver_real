'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

export default function DebugPage() {
  const [supabaseStatus, setSupabaseStatus] = useState('확인 중...');
  const [authStatus, setAuthStatus] = useState('확인 중...');

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        // Supabase 연결 테스트
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (error) {
          setSupabaseStatus(`❌ 오류: ${error.message}`);
        } else {
          setSupabaseStatus('✅ 연결 성공');
        }
      } catch (err: any) {
        setSupabaseStatus(`❌ 예외: ${err.message}`);
      }

      try {
        // Auth 상태 확인
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          setAuthStatus(`❌ Auth 오류: ${error.message}`);
        } else {
          setAuthStatus(session ? '✅ 로그인됨' : '❌ 로그인 안됨');
        }
      } catch (err: any) {
        setAuthStatus(`❌ Auth 예외: ${err.message}`);
      }
    };

    checkSupabase();
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔍 디버그 정보</h1>
      
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
          <p>User Agent: {typeof window !== 'undefined' ? window.navigator.userAgent : 'Server'}</p>
          <p>URL: {typeof window !== 'undefined' ? window.location.href : 'Server'}</p>
        </div>
      </div>
    </div>
  );
} 