'use client';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

// ✅ 로그 찍어보기
console.log('✅ SUPABASE_URL from ENV:', SUPABASE_URL);
console.log('✅ ANON_KEY from ENV:', SUPABASE_ANON_KEY);

import { useState, useEffect } from 'react';
import ChatRoom from './ChatRoom';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import supabase, { initSession } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 주문번호로 채팅방을 초기화한 후 채팅 컴포넌트를 렌더링하는 컴포넌트
 */
interface ChatWithOrderInitProps {
  orderNumber: string;
  currentUserId: string;
}

export default function ChatWithOrderInit({ orderNumber, currentUserId }: ChatWithOrderInitProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // env.ts에서 가져온 Supabase 정보 사용
  console.log('✅ env.ts에서 가져온 SUPABASE_URL:', SUPABASE_URL);
  console.log('✅ env.ts에서 가져온 ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 10) + '...');

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      try {
        // 세션 초기화
        const session = await initSession();
        if (!session) {
          setError('로그인이 필요합니다');
          setLoading(false);
          return;
        }

        console.log('[ChatWithOrderInit] 사용자 인증 완료:', session.user.id);
        console.log('[ChatWithOrderInit] 주문번호:', orderNumber);
        console.log('[ChatWithOrderInit] 현재 사용자:', currentUserId);

        // 채팅방 초기화 API 호출
        const response = await fetch('/api/chat/init-room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderNumber }),
          credentials: 'include' // 쿠키 전송을 위한 설정 추가
        });

        // API 응답 처리
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '채팅방 초기화 중 오류가 발생했습니다');
        }

        const data = await response.json();
        console.log('[ChatWithOrderInit] 채팅방 초기화 성공:', data);

        // 채팅방으로 이동
        router.push(`/chat/${data.roomId}`);
      } catch (error: any) {
        console.error('[ChatWithOrderInit] 초기화 오류:', error);
        setError(error.message || '채팅방 초기화 중 알 수 없는 오류가 발생했습니다');
        toast({
          variant: 'destructive',
          title: '오류',
          description: error.message || '채팅방 초기화 중 알 수 없는 오류가 발생했습니다',
        });
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [orderNumber, currentUserId, router, toast]);

  // 로딩 중 UI
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">채팅방을 준비하고 있습니다...</p>
      </div>
    );
  }

  // 오류 UI
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
} 