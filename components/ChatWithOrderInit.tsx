'use client';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

// ✅ 로그 찍어보기
console.log('✅ SUPABASE_URL from ENV:', SUPABASE_URL);
console.log('✅ ANON_KEY from ENV:', SUPABASE_ANON_KEY);

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

/**
 * 주문번호로 채팅방을 초기화한 후 채팅 컴포넌트를 렌더링하는 컴포넌트
 */
interface ChatWithOrderInitProps {
  orderNumber: string;
  onNavigateToChat?: (roomId: string) => void;
}

const ChatWithOrderInit: React.FC<ChatWithOrderInitProps> = ({ 
  orderNumber, 
  onNavigateToChat 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // env.ts에서 가져온 Supabase 정보 사용
  console.log('✅ env.ts에서 가져온 SUPABASE_URL:', SUPABASE_URL);
  console.log('✅ env.ts에서 가져온 ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 10) + '...');

  const initiateChatWithOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 세션 확인
      const supabase = await getSupabaseClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        router.push('/login');
        return;
      }

      // 채팅방 초기화 API 호출
      const response = await fetch('/api/chat/init-with-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderNumber: orderNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '채팅방 생성에 실패했습니다.');
      }

      const { roomId } = await response.json();

      // 채팅 페이지로 이동
      if (onNavigateToChat) {
        onNavigateToChat(roomId);
      } else {
        router.push(`/chat/${roomId}`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initiateChatWithOrder();
  }, [orderNumber, router]);

  // 로딩 중 UI
  if (isLoading) {
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
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <p className="text-destructive text-center">{error}</p>
        <Button 
          onClick={initiateChatWithOrder} 
          disabled={isLoading}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  // 기본 상태 (로딩 중)
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default ChatWithOrderInit; 