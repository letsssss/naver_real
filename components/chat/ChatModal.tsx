"use client";

import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';
import { Button } from '@/components/ui/button';
import { X, Send } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  sender_id: string;
  isMine: boolean;
  isRead?: boolean;
  status?: 'sending' | 'sent' | 'failed';
  clientId?: string;
}

interface ChatModalProps {
  roomId: string;
  onClose: () => void;
}

export default function ChatModal({ roomId, onClose }: ChatModalProps) {
  const supabase = createClientComponentClient<Database>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 현재 사용자 정보 및 채팅방 데이터 로드
  useEffect(() => {
    const fetchChatData = async () => {
      try {
        setIsLoading(true);
        
        // 현재 로그인한 사용자 정보 가져오기
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          setError('로그인이 필요합니다.');
          setIsLoading(false);
          return;
        }
        
        setCurrentUser(user);
        
        // 채팅방 정보 가져오기
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*, buyer:buyer_id(*), seller:seller_id(*)')
          .eq('id', roomId)
          .single();
          
        if (roomError || !roomData) {
          setError('채팅방을 찾을 수 없습니다.');
          setIsLoading(false);
          return;
        }
        
        // 대화 상대방 정보 설정
        const otherUserId = roomData.buyer_id === user.id ? roomData.seller_id : roomData.buyer_id;
        const otherUserData = roomData.buyer_id === user.id ? roomData.seller : roomData.buyer;
        setOtherUser(otherUserData);
        
        // 메시지 가져오기
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });
          
        if (messagesError) {
          console.error('메시지 로드 오류:', messagesError);
        } else if (messagesData) {
          // 메시지 포맷팅
          const formattedMessages = messagesData.map(msg => ({
            id: msg.id,
            text: msg.content,
            timestamp: msg.created_at,
            sender_id: msg.sender_id,
            isMine: msg.sender_id === user.id,
            isRead: msg.is_read,
          }));
          
          setMessages(formattedMessages);
        }
        
        // 읽지 않은 메시지 읽음 처리
        if (messagesData && messagesData.length > 0) {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('room_id', roomId)
            .eq('receiver_id', user.id)
            .eq('is_read', false);
        }
        
      } catch (err) {
        console.error('채팅 데이터 로드 오류:', err);
        setError('채팅 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchChatData();
    
    // 모달 열리면 autofocus 주기
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
    
  }, [roomId, supabase]);
  
  // 실시간 메시지 구독
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      }, payload => {
        const newMessage = payload.new as any;
        
        if (currentUser && newMessage) {
          // 새 메시지를 상태에 추가
          setMessages(prev => [
            ...prev, 
            {
              id: newMessage.id,
              text: newMessage.content,
              timestamp: newMessage.created_at,
              sender_id: newMessage.sender_id,
              isMine: newMessage.sender_id === currentUser.id,
              isRead: newMessage.is_read,
            }
          ]);
          
          // 내가 받은 메시지라면 읽음 처리
          if (newMessage.sender_id !== currentUser.id) {
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMessage.id)
              .then(({ error }) => {
                if (error) console.error('메시지 읽음 처리 오류:', error);
              });
          }
          
          // 새 메시지가 오면 스크롤 아래로
          scrollToBottom();
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase, currentUser]);
  
  // 메시지 스크롤 맨 아래로
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 메시지 전송 함수
  const handleSendMessage = async () => {
    if (!currentUser || !newMessage.trim()) return;
    
    try {
      // 임시 ID로 낙관적 UI 업데이트
      const tempId = Date.now().toString();
      const tempMessage: Message = {
        id: tempId,
        text: newMessage,
        timestamp: new Date().toISOString(),
        sender_id: currentUser.id,
        isMine: true,
        status: 'sending',
        clientId: tempId,
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage(''); // 메시지 입력란 비우기
      
      // Supabase에 메시지 저장
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content: newMessage,
          room_id: roomId,
          sender_id: currentUser.id,
          receiver_id: otherUser?.id,
          is_read: false,
        })
        .select()
        .single();
        
      if (error) {
        console.error('메시지 전송 오류:', error);
        
        // 오류 상태로 메시지 UI 업데이트
        setMessages(prev => 
          prev.map(msg => 
            msg.clientId === tempId 
              ? { ...msg, status: 'failed' } 
              : msg
          )
        );
        return;
      }
      
      // 성공 상태로 UI 업데이트
      setMessages(prev => 
        prev.map(msg => 
          msg.clientId === tempId 
            ? { 
                id: data.id, 
                text: data.content, 
                timestamp: data.created_at, 
                sender_id: data.sender_id,
                isMine: true,
                status: 'sent',
                clientId: tempId,
              } 
            : msg
        )
      );
      
    } catch (err) {
      console.error('메시지 전송 중 오류 발생:', err);
    }
  };
  
  // 엔터 키 메시지 전송 처리
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 모달 외부 클릭시 닫기 방지 (이벤트 버블링 중단)
  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden"
        onClick={handleModalContentClick}
      >
        {/* 채팅 헤더 */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white">
              {otherUser?.name ? otherUser.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h3 className="font-medium">{otherUser?.name || '사용자'}</h3>
              <p className="text-xs text-gray-500">
                {otherUser?.role === 'seller' ? '판매자' : '구매자'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 로딩 표시 */}
        {isLoading && (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500"></div>
          </div>
        )}

        {/* 에러 표시 */}
        {error && !isLoading && (
          <div className="flex items-center justify-center flex-1 p-4">
            <div className="bg-red-50 text-red-500 p-4 rounded-md">
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* 채팅 메시지 영역 */}
        {!isLoading && !error && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-center">
                  아직 메시지가 없습니다.<br />
                  첫 메시지를 보내보세요!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.isMine
                          ? 'bg-teal-500 text-white rounded-tr-none'
                          : 'bg-gray-200 text-gray-800 rounded-tl-none'
                      }`}
                    >
                      <p className="text-sm break-words">{message.text}</p>
                      <div className="flex items-center justify-end mt-1 space-x-1">
                        <span className="text-xs opacity-80">
                          {new Date(message.timestamp).toLocaleTimeString('ko-KR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                        {message.isMine && message.status && (
                          <span className="text-xs">
                            {message.status === 'sending' && '전송 중...'}
                            {message.status === 'sent' && '✓'}
                            {message.status === 'failed' && '⚠️'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        )}

        {/* 메시지 입력 영역 */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요..."
              className="flex-1 py-2 px-4 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={isLoading || !!error}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !!error || !newMessage.trim()}
              className="rounded-full w-10 h-10 flex items-center justify-center p-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 