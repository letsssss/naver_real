'use client';

import { useState, useEffect } from 'react';
import ChatRoom from './ChatRoom';

/**
 * 주문번호로 채팅방을 초기화한 후 채팅 컴포넌트를 렌더링하는 컴포넌트
 */
interface ChatWithOrderInitProps {
  orderNumber: string;
  currentUserId: string;
}

const ChatWithOrderInit = ({ orderNumber, currentUserId }: ChatWithOrderInitProps) => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 채팅방 초기화
  useEffect(() => {
    async function initChatRoom() {
      if (!orderNumber || !currentUserId) {
        setError('주문 번호 또는 사용자 정보가 없습니다.');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        console.log(`[채팅 초기화] 주문번호: ${orderNumber} 채팅방 초기화 시도`);
        
        const response = await fetch('/api/chat/init-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ order_number: orderNumber }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || '채팅방 초기화에 실패했습니다.');
        }
        
        console.log(`[채팅 초기화] 채팅방 준비 완료: ${data.room_name} (ID: ${data.room_id})`);
        setRoomId(data.room_id);
      } catch (err) {
        console.error('[채팅 초기화] 오류:', err);
        setError(err instanceof Error ? err.message : '채팅방을 초기화하는데 문제가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    
    initChatRoom();
  }, [orderNumber, currentUserId]);
  
  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-40 mx-auto"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 border rounded-lg shadow-sm bg-white">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">채팅 초기화 오류</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }
  
  if (!roomId) {
    return (
      <div className="p-6 text-center border rounded-lg shadow-sm bg-white">
        <p className="text-gray-600">채팅방을 불러올 수 없습니다.</p>
      </div>
    );
  }
  
  return <ChatRoom roomId={roomId} orderNumber={orderNumber} currentUserId={currentUserId} />;
};

export default ChatWithOrderInit; 