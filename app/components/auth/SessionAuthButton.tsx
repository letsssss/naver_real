"use client";

import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function SessionAuthButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  const checkSession = async () => {
    setIsLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        setSessionInfo({ error: error.message });
      } else {
        setSessionInfo({
          hasSession: !!session,
          user: session?.user || null,
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : null
        });
      }
    } catch (error) {
      setSessionInfo({ error: 'Session check failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    setIsLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        setSessionInfo({ error: error.message });
      } else {
        setSessionInfo({
          hasSession: !!data.session,
          user: data.session?.user || null,
          refreshed: true
        });
      }
    } catch (error) {
      setSessionInfo({ error: 'Session refresh failed' });
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
      
      {sessionInfo?.hasSession && (
        <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
          {sessionInfo.user ? `세션 갱신 성공! 만료 시간: ${sessionInfo.expiresAt}` : '세션이 갱신되었습니다.'}
        </div>
      )}
      
      {sessionInfo?.error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {sessionInfo.error}
          {sessionInfo.error.includes('로그인') && (
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