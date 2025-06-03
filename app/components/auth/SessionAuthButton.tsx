'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function SessionAuthButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const refreshSession = async () => {
    setIsLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      // 현재 세션 확인
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setStatus('error');
        setMessage('로그인된 세션이 없습니다. 먼저 로그인해주세요.');
        setIsLoading(false);
        return;
      }
      
      // 세션 갱신 시도
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('세션 갱신 실패:', error.message);
        setStatus('error');
        setMessage(`세션 갱신 실패: ${error.message}`);
        setIsLoading(false);
        return;
      }
      
      if (data.session) {
        const expiresAt = data.session.expires_at || 0;
        const expiryDate = new Date(expiresAt * 1000);
        console.log('세션 갱신 성공!', data.session.user.id);
        console.log('새 토큰 만료 시간:', expiryDate.toLocaleString());
        
        setStatus('success');
        setMessage(`세션 갱신 성공! 만료 시간: ${expiryDate.toLocaleString()}`);
      } else {
        setStatus('error');
        setMessage('세션 갱신에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('세션 갱신 중 오류 발생:', error);
      setStatus('error');
      setMessage(`세션 갱신 중 오류 발생: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    window.location.href = '/auth/login';
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <Button 
        onClick={refreshSession} 
        disabled={isLoading}
        className="w-full"
        variant="default"
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        JWT 토큰 갱신하기
      </Button>
      
      {status === 'success' && (
        <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
          {message}
        </div>
      )}
      
      {status === 'error' && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {message}
          {message.includes('로그인') && (
            <Button 
              variant="ghost"
              className="mt-2 p-0 h-auto text-red-700 underline" 
              onClick={handleLoginRedirect}
            >
              로그인 페이지로 이동
            </Button>
          )}
        </div>
      )}
    </div>
  );
} 