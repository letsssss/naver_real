"use client";

import { useEffect, useState, useRef } from 'react';
import type { Database } from '@/types/supabase.types';
import { Button } from '@/components/ui/button';
import { X, Send } from 'lucide-react';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import supabase from '@/lib/supabase-browser';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNewMessage = (newMessage: any) => {
    if (!currentUser) return;

    setMessages(prev => {
      if (prev.some(msg => msg.id === newMessage.id)) return prev;
      return [
        ...prev,
        {
          id: newMessage.id,
          text: newMessage.content,
          timestamp: newMessage.created_at,
          sender_id: newMessage.sender_id,
          isMine: newMessage.sender_id === currentUser.id,
          isRead: newMessage.is_read,
        },
      ];
    });

    if (newMessage.sender_id !== currentUser.id) {
      supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', newMessage.id);
    }

    scrollToBottom();
  };

  const hasUserId = !!currentUser?.id;

  useRealtimeMessages(
    hasUserId ? roomId : '',
    handleNewMessage,
    currentUser?.id,
    setMessages
  );

  useEffect(() => {
    const fetchChatData = async () => {
      try {
        setIsLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setError('로그인이 필요합니다.');
          return;
        }
        setCurrentUser(user);

        const { data: roomData } = await supabase
          .from('rooms')
          .select('*, buyer:buyer_id(*), seller:seller_id(*)')
          .eq('id', roomId)
          .single();

        const otherUserId = roomData.buyer_id === user.id ? roomData.seller_id : roomData.buyer_id;
        const otherUserData = roomData.buyer_id === user.id ? roomData.seller : roomData.buyer;
        setOtherUser(otherUserData);

        const { data: messagesData } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        const formatted = messagesData ? messagesData.map(msg => ({
          id: msg.id,
          text: msg.content,
          timestamp: msg.created_at,
          sender_id: msg.sender_id,
          isMine: msg.sender_id === user.id,
          isRead: msg.is_read,
        })) : [];
        setMessages(formatted);

        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('room_id', roomId)
          .eq('receiver_id', user.id)
          .eq('is_read', false);

        setMessages(prev =>
          prev.map(msg =>
            !msg.isMine && !msg.isRead ? { ...msg, isRead: true } : msg
          )
        );
      } catch (err) {
        setError('채팅 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatData();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [roomId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!currentUser || !newMessage.trim()) return;

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
    setNewMessage('');

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
      setMessages(prev =>
        prev.map(msg =>
          msg.clientId === tempId ? { ...msg, status: 'failed' } : msg
        )
      );
      return;
    }

    setMessages(prev =>
      prev.map(msg =>
        msg.clientId === tempId
          ? {
              id: data.id,
              text: data.content,
              timestamp: data.created_at,
              sender_id: data.sender_id,
              isMine: true,
              isRead: data.is_read,
              status: 'sent',
              clientId: tempId,
            }
          : msg
      )
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white">
              {otherUser?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="font-medium">{otherUser?.name || '사용자'}</h3>
              <p className="text-xs text-gray-500">{otherUser?.role === 'seller' ? '판매자' : '구매자'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center flex-1 p-4">
            <div className="bg-red-50 text-red-500 p-4 rounded-md">
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-center">
                  아직 메시지가 없습니다.<br />첫 메시지를 보내보세요!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      message.isMine
                        ? 'bg-teal-500 text-white rounded-tr-none'
                        : 'bg-gray-200 text-gray-800 rounded-tl-none'
                    }`}>
                      <p className="text-sm break-words">{message.text}</p>
                      <div className="flex items-center justify-end mt-1 space-x-1">
                        <span className="text-xs opacity-80">
                          {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {message.isMine && (
                          <span className="text-xs">
                            {message.status === 'sending' && '전송 중...'}
                            {message.status === 'failed' && '⚠️'}
                            {message.status === 'sent' && (message.isRead ? '읽음' : '전송됨')}
                            {!message.status && (message.isRead ? '읽음' : '전송됨')}
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

        <div className="p-4 border-t bg-white">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="메시지를 입력하세요..."
              className="flex-1 py-2 px-4 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
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