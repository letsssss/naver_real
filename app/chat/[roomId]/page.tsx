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

  useEffect(() => {
    const redirectToDashboard = async () => {
      console.log('[ChatRedirect] 🚀 시작, roomId:', roomId);
      
      try {
        // Supabase 클라이언트 초기화
        const supabase = await getSupabaseClient();
        console.log('[ChatRedirect] ✅ Supabase 클라이언트 초기화 완료');
        
        // 로그인 확인
        console.log('[ChatRedirect] 🔐 사용자 인증 확인 중...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.log('[ChatRedirect] ❌ 로그인 필요 - 로그인 페이지로 이동:', userError?.message);
          router.push('/login');
          return;
        }
        
        console.log('[ChatRedirect] ✅ 사용자 인증 완료:', {
          userId: user.id,
          email: user.email
        });
        
        // 채팅방 정보 확인
        if (roomId) {
          console.log(`[ChatRedirect] 🔍 채팅방 정보 조회 시작 - roomId: ${roomId}`);
          const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('order_number, buyer_id, seller_id, purchase_id, post_id')
            .eq('id', roomId)
            .single();
          
          if (roomError) {
            console.error('[ChatRedirect] ❌ 채팅방 정보 로드 오류:', {
              error: roomError.message,
              code: roomError.code,
              roomId
            });
            router.push('/dashboard');
            return;
          }
          
          console.log('[ChatRedirect] ✅ 채팅방 정보 로드 성공:', {
            roomId,
            order_number: roomData.order_number,
            buyer_id: roomData.buyer_id,
            seller_id: roomData.seller_id,
            purchase_id: roomData.purchase_id,
            post_id: roomData.post_id
          });
          
          // 접근 권한 확인
          const isBuyer = roomData.buyer_id === user.id;
          const isSeller = roomData.seller_id === user.id;
          const hasAccess = isBuyer || isSeller;
          
          console.log('[ChatRedirect] 🔐 접근 권한 확인:', {
            userId: user.id,
            buyerId: roomData.buyer_id,
            sellerId: roomData.seller_id,
            isBuyer,
            isSeller,
            hasAccess
          });
          
          if (!hasAccess) {
            console.log('[ChatRedirect] ❌ 채팅방 접근 권한 없음 - 대시보드로 이동');
            router.push('/dashboard');
            return;
          }
          
          console.log('[ChatRedirect] ✅ 접근 권한 확인 완료 -', isBuyer ? '구매자' : '판매자');
          
          // 세션 스토리지에 채팅방 ID 저장 (transaction 페이지에서 모달 띄울 때 사용)
          try {
            console.log('[ChatRedirect] 💾 세션 스토리지에 저장 시작:', roomId);
            // 먼저 기존 값 확인
            const existing = sessionStorage.getItem('openChatRoomId');
            if (existing) {
              console.log('[ChatRedirect] 📄 기존 세션 스토리지 값:', existing);
            }
            
            // 새 값 저장
            sessionStorage.setItem('openChatRoomId', roomId);
            
            // 정상 저장됐는지 다시 확인
            const saved = sessionStorage.getItem('openChatRoomId');
            console.log('[ChatRedirect] ✅ 저장 후 세션 스토리지 값:', saved);
            
            if (saved !== roomId) {
              console.error('[ChatRedirect] ⚠️ 세션 스토리지 저장 불일치!');
            }
          } catch (storageError) {
            console.error('[ChatRedirect] ❌ 세션 스토리지 저장 오류:', storageError);
            // 세션 스토리지 오류는 치명적이지 않으므로 계속 진행
          }
          
          // 연관된 거래가 있으면 거래 페이지로, 아니면 대시보드로
          if (roomData.order_number) {
            const targetUrl = `/transaction/${roomData.order_number}`;
            console.log(`[ChatRedirect] 🎯 거래 페이지로 이동: ${targetUrl}`);
            router.push(targetUrl);
            console.log('[ChatRedirect] ✅ 거래 페이지로 이동 명령 완료');
          } else {
            console.log('[ChatRedirect] 🏠 대시보드로 이동 (주문번호 없음)');
            router.push('/dashboard');
          }
          
        } else {
          console.log('[ChatRedirect] ❌ 채팅방 ID 없음 - 대시보드로 이동');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('[ChatRedirect] ❌ 예외 발생:', {
          message: error?.message,
          stack: error?.stack
        });
        router.push('/dashboard');
      }
    };
    
    // 클라이언트 사이드에서만 실행
    if (typeof window !== 'undefined') {
      redirectToDashboard();
    }
  }, [roomId, router]);

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