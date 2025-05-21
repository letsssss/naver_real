'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function Page() {
  const router = useRouter();
  
  useEffect(() => {
    // 사용자가 로그인 중인지 확인 (URL 해시에 access_token이 있는지 확인)
    const isAuthCallback = window.location.hash.includes('access_token');
    
    // 인증 콜백이 아닌 경우에만 리디렉션
    if (!isAuthCallback) {
      router.push('/ticket-cancellation');
    }
  }, [router]);
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">이지티켓에 오신 것을 환영합니다</h1>
      <p className="mb-4">안전하고 빠른 티켓 거래 서비스를 이용해 보세요.</p>
    </div>
  );
}

