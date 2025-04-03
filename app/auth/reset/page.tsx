"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function AuthReset() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("인증 데이터 초기화 중...");

  // 로컬 스토리지에서 안전하게 삭제하는 함수
  const clearLocalStorage = () => {
    try {
      // 인증 관련 모든 데이터 삭제
      const keysToRemove = [
        'token', 'user', 'auth-token', 'auth-status', 
        'supabase-auth-token', 'supabase_token',
        'sb-access-token', 'sb-refresh-token',
        'kakao_auth_mode'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      });

      return true;
    } catch (e) {
      console.error("로컬 스토리지 삭제 오류:", e);
      return false;
    }
  };

  useEffect(() => {
    const resetAuthData = async () => {
      try {
        // 1. 클라이언트 측 데이터 삭제
        const localStorageCleared = clearLocalStorage();
        
        if (localStorageCleared) {
          setStatus("로컬 스토리지 데이터가 삭제되었습니다...");
        }
        
        // 2. 서버 측 쿠키 초기화 API 호출
        setStatus("서버 쿠키 초기화 중...");
        
        const response = await fetch('/api/auth/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          setStatus("인증 데이터가 초기화되었습니다. 로그인 페이지로 이동합니다...");
          toast.success("인증 데이터가 초기화되었습니다.");
          
          // 짧은 딜레이 후 로그인 페이지로 이동
          setTimeout(() => {
            router.push('/login');
          }, 1500);
        } else {
          setStatus("서버 쿠키 초기화 중 오류가 발생했습니다.");
          toast.error("인증 데이터 초기화 중 오류가 발생했습니다.");
        }
      } catch (error) {
        console.error("인증 데이터 초기화 중 오류:", error);
        setStatus("인증 데이터 초기화 중 오류가 발생했습니다.");
        toast.error("인증 데이터 초기화 중 오류가 발생했습니다.");
      }
    };

    resetAuthData();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">인증 초기화</h1>
        <p className="mb-4">{status}</p>
        <div className="w-12 h-12 border-4 border-t-blue-500 border-b-blue-500 border-l-transparent border-r-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
        >
          로그인 페이지로 이동
        </button>
      </div>
    </div>
  );
} 