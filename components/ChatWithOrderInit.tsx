'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase 설정 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ 로그 찍어보기
console.log('✅ SUPABASE_URL from ENV:', supabaseUrl);
console.log('✅ ANON_KEY from ENV:', supabaseAnonKey.substring(0, 10) + '...');

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

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      try {
        // Supabase 클라이언트 생성
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        // 현재 세션 가져오기
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          setError('로그인이 필요합니다');
          setLoading(false);
          return;
        }

        console.log('[ChatWithOrderInit] 사용자 인증 완료:', session.user.id);
        console.log('[ChatWithOrderInit] 주문번호:', orderNumber);
        console.log('[ChatWithOrderInit] 현재 사용자:', currentUserId);

        // 세션에서 액세스 토큰 가져오기
        const accessToken = session.access_token;

        // 채팅방 초기화 API 호출
        const response = await fetch('/api/chat/init-room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ order_number: orderNumber }),
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

      } catch (err: any) {
        console.error('[ChatWithOrderInit] 오류:', err);
        setError(err.message || '채팅방 초기화 중 오류가 발생했습니다');
        toast({
          title: '오류',
          description: err.message || '채팅방 초기화 중 오류가 발생했습니다',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [orderNumber, currentUserId, router, toast]);

  if (loading) {
    return <div>채팅방을 초기화하는 중...</div>;
  }

  if (error) {
    return <div>오류: {error}</div>;
  }

  return null;
} 