"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

export default function ChatRoomRedirect() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId;
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const redirectToDashboard = async () => {
      try {
        // 로그인 확인
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          router.push('/login');
          return;
        }
        
        // 채팅방 정보 확인
        if (roomId) {
          const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('order_number, buyer_id, seller_id')
            .eq('id', roomId)
            .single();
          
          if (roomError) {
            console.error('채팅방 정보 로드 오류:', roomError);
            router.push('/dashboard');
            return;
          }
          
          // 접근 권한 확인
          const hasAccess = roomData.buyer_id === user.id || roomData.seller_id === user.id;
          if (!hasAccess) {
            router.push('/dashboard');
            return;
          }
          
          // 세션 스토리지에 채팅방 ID 저장 (대시보드에서 모달 띄울 때 사용)
          sessionStorage.setItem('openChatRoomId', roomId);
          
          // 연관된 거래가 있으면 거래 페이지로, 아니면 대시보드로
          if (roomData.order_number) {
            router.push(`/transaction/${roomData.order_number}`);
          } else {
            router.push('/dashboard');
          }
          
        } else {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('리디렉션 오류:', error);
        router.push('/dashboard');
      }
    };
    
    redirectToDashboard();
  }, [roomId, router, supabase]);

  // 리디렉션 중에 보여줄 로딩 UI
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto mb-4"></div>
        <p className="text-gray-600">채팅방으로 이동 중...</p>
      </div>
    </div>
  );
} 