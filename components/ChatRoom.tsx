'use client';

import { useEffect, useRef } from 'react';
import { useChatWithRoomInit, ChatMessage } from '@/hooks/useChatWithRoomInit';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ChatRoomProps {
  roomId: string;
  orderNumber?: string;
  currentUserId?: string;
}

const ChatRoom = ({ roomId, currentUserId = '' }: ChatRoomProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    participants,
    newMessage,
    setNewMessage,
    sendMessage,
    sendMessageWithEnter,
    loading,
    sendingMessage,
    error,
    roomName
  } = useChatWithRoomInit(roomId, currentUserId);
  
  // 채팅창 자동 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // 참가자 정보 확인
  const otherParticipant = participants.find(p => p.user_id !== currentUserId)?.user;
  
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-96">
        <div className="animate-pulse text-center">
          <div className="h-5 bg-gray-200 rounded w-40 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-2">오류가 발생했습니다</div>
        <p className="text-sm text-gray-600">{error}</p>
        <button 
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          onClick={() => window.location.reload()}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg shadow-sm bg-white">
      {/* 헤더 */}
      <div className="p-4 border-b flex items-center">
        {otherParticipant ? (
          <>
            <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
              {otherParticipant.profile_image ? (
                <img 
                  src={otherParticipant.profile_image} 
                  alt={otherParticipant.name}
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white">
                  {otherParticipant.name.substring(0, 1)}
                </div>
              )}
            </div>
            <div className="ml-3">
              <h3 className="font-medium">{otherParticipant.name}</h3>
              <p className="text-xs text-gray-500">{roomName}</p>
            </div>
          </>
        ) : (
          <div className="ml-3">
            <h3 className="font-medium">채팅방</h3>
            <p className="text-xs text-gray-500">{roomName}</p>
          </div>
        )}
      </div>
      
      {/* 메시지 영역 */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p>아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isMe={message.sender_id === currentUserId} 
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* 입력 영역 */}
      <div className="p-4 border-t">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={sendMessageWithEnter}
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-l-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sendingMessage}
          />
          <button
            onClick={sendMessage}
            disabled={sendingMessage || !newMessage.trim()}
            className={`px-4 py-2 rounded-r-md ${
              sendingMessage || !newMessage.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {sendingMessage ? '전송 중...' : '전송'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 메시지 버블 컴포넌트
interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
}

const MessageBubble = ({ message, isMe }: MessageBubbleProps) => {
  const formattedTime = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
    locale: ko
  });
  
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[70%] p-3 rounded-lg ${
          isMe 
            ? 'bg-blue-500 text-white rounded-tr-none' 
            : 'bg-white border border-gray-200 rounded-tl-none'
        }`}
      >
        {!isMe && message.sender && (
          <div className="text-xs font-medium mb-1">
            {message.sender.name}
          </div>
        )}
        <p className="break-words">{message.content}</p>
        <div 
          className={`text-xs mt-1 ${
            isMe ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {formattedTime}
          {isMe && (
            <span className="ml-1">{message.is_read ? '읽음' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatRoom; 