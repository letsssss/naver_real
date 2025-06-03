"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';
import { getSupabaseClient } from '@/lib/supabase'; 

export default function ChatRoomRedirect() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId;
  const router = useRouter();
  //const supabase = createClientComponentClient<Database>();
  const supabase = getSupabaseClient();
  useEffect(() => {
    const redirectToDashboard = async () => {
      console.log('[Redirect] 시작, roomId:', roomId);
      
      try {
        // 로그인 확인
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.log('[Redirect] 로그인 필요, 로그인 페이지로 이동');
          router.push('/login');
          return;
        }
        
        console.log('[Redirect] 사용자 인증 완료, user.id:', user.id);
        
        // 채팅방 정보 확인
        if (roomId) {
          console.log(`[Redirect] 채팅방 정보 가져오기 시작, roomId: ${roomId}`);
          const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('order_number, buyer_id, seller_id')
            .eq('id', roomId)
            .single();
          
          if (roomError) {
            console.error('[Redirect] 채팅방 정보 로드 오류:', roomError);
            router.push('/dashboard');
            return;
          }
          
          console.log('[Redirect] 채팅방 정보 로드 성공:', 
            JSON.stringify({
              order_number: roomData.order_number,
              buyer_id: roomData.buyer_id,
              seller_id: roomData.seller_id
            })
          );
          
          // 접근 권한 확인
          const hasAccess = roomData.buyer_id === user.id || roomData.seller_id === user.id;
          if (!hasAccess) {
            console.log('[Redirect] 채팅방 접근 권한 없음, 대시보드로 이동');
            router.push('/dashboard');
            return;
          }
          
          // 세션 스토리지에 채팅방 ID 저장 (transaction 페이지에서 모달 띄울 때 사용)
          try {
            console.log('[Redirect] 세션 스토리지에 저장:', roomId);
            // 먼저 기존 값 확인
            const existing = sessionStorage.getItem('openChatRoomId');
            if (existing) {
              console.log('[Redirect] 기존 세션 스토리지 값:', existing);
            }
            
            // 새 값 저장
            sessionStorage.setItem('openChatRoomId', roomId);
            
            // 정상 저장됐는지 다시 확인
            const saved = sessionStorage.getItem('openChatRoomId');
            console.log('[Redirect] 저장 후 세션 스토리지 값:', saved);
            
            if (saved !== roomId) {
              console.error('[Redirect] 세션 스토리지 저장 불일치!');
            }
          } catch (storageError) {
            console.error('[Redirect] 세션 스토리지 저장 오류:', storageError);
            // 세션 스토리지 오류는 치명적이지 않으므로 계속 진행
          }
          
          // 연관된 거래가 있으면 거래 페이지로, 아니면 대시보드로
          if (roomData.order_number) {
            console.log(`[Redirect] 거래 페이지로 이동 시작: /transaction/${roomData.order_number}`);
            router.push(`/transaction/${roomData.order_number}`);
            console.log('[Redirect] 거래 페이지로 이동 명령 완료');
          } else {
            console.log('[Redirect] 대시보드로 이동');
            router.push('/dashboard');
          }
          
        } else {
          console.log('[Redirect] 채팅방 ID 없음, 대시보드로 이동');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('[Redirect] 예외 발생:', error);
        router.push('/dashboard');
      }
    };
    
    // 클라이언트 사이드에서만 실행
    if (typeof window !== 'undefined') {
      redirectToDashboard();
    }
  }, [roomId, router, supabase]);

  // 리디렉션 중에 보여줄 로딩 UI
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto mb-4"></div>
        <p className="text-gray-600">채팅방으로 이동 중...</p>
        <p className="text-gray-400 text-sm mt-2">Room ID: {roomId}</p>
      </div>
    </div>
  );
} 