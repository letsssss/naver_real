"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, Send } from 'lucide-react';
import { Message } from '@/types/chat';
import { getSupabaseClient } from '@/lib/supabase';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
  otherUserName: string;
  otherUserProfileImage?: string;
  otherUserRole: string;
  otherUserPhone?: string;
  onMarkAsRead?: () => Promise<boolean>;
}

// 채팅 인터페이스 싱글톤 관리자
class ChatInterfaceManager {
  private static instance: ChatInterfaceManager | null = null;
  private activeChats: Set<string> = new Set();
  private messageQueue: Map<string, Message[]> = new Map();
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): ChatInterfaceManager {
    if (!ChatInterfaceManager.instance) {
      ChatInterfaceManager.instance = new ChatInterfaceManager();
    }
    return ChatInterfaceManager.instance;
  }

  public registerChat(chatId: string): void {
    this.activeChats.add(chatId);
    if (!this.messageQueue.has(chatId)) {
      this.messageQueue.set(chatId, []);
    }
  }

  public unregisterChat(chatId: string): void {
    this.activeChats.delete(chatId);
    this.messageQueue.delete(chatId);
  }

  public queueMessage(chatId: string, message: Message): void {
    const queue = this.messageQueue.get(chatId) || [];
    queue.push(message);
    this.messageQueue.set(chatId, queue);
  }

  public getQueuedMessages(chatId: string): Message[] {
    return this.messageQueue.get(chatId) || [];
  }

  public clearQueue(chatId: string): void {
    this.messageQueue.set(chatId, []);
  }
}

export function ChatInterface({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  otherUserName,
  otherUserProfileImage = '/placeholder.svg',
  otherUserRole,
  otherUserPhone,
  onMarkAsRead
}: ChatInterfaceProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatManager = useRef(ChatInterfaceManager.getInstance());
  const chatId = useRef(`chat-${Date.now()}`);

  // 입력 관련 상태 및 참조
  const inputTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInputTimeRef = useRef<number>(0);
  const minimumInputDelayRef = useRef<number>(300);
  const inputValueRef = useRef<string>('');

  // 채팅방 등록 및 해제
  useEffect(() => {
    if (isOpen) {
      chatManager.current.registerChat(chatId.current);
    }
    return () => {
      chatManager.current.unregisterChat(chatId.current);
    };
  }, [isOpen]);

  // 메시지 스크롤 처리
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  // 메시지 전송 처리
  const handleSendMessage = async () => {
    if (isSending || !newMessage.trim()) return;

    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');
    let messageSent = false;
    
    try {
      messageSent = await onSendMessage(messageContent);
      
      if (messageSent && otherUserPhone) {
        try {
          const notifyResponse = await fetch('/api/kakao/notify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: otherUserPhone,
              name: otherUserName,
              message: messageContent
            }),
          });
          
          const notifyResult = await notifyResponse.json();
          
          if (notifyResult.success) {
            console.log('✅ 카카오 알림톡 전송 성공:', notifyResult);
          } else {
            console.error('⚠️ 카카오 알림톡 전송 실패:', notifyResult.error);
          }
        } catch (notifyError) {
          console.error('❌ 카카오 알림톡 전송 중 오류:', notifyError);
        }
      }
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSending(false);
    }
  };

  // 입력 처리
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    inputValueRef.current = value;

    if (inputTimerRef.current) {
      clearTimeout(inputTimerRef.current);
    }

    const now = Date.now();
    const timeSinceLastInput = now - lastInputTimeRef.current;

    if (timeSinceLastInput < minimumInputDelayRef.current) {
      inputTimerRef.current = setTimeout(() => {
        setNewMessage(inputValueRef.current);
      }, minimumInputDelayRef.current - timeSinceLastInput);
    }

    lastInputTimeRef.current = now;
  };

  // 엔터 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 메시지 시간 포맷팅
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Seoul'
    });
  };

  // 채팅창이 열리거나 메시지가 업데이트될 때 스크롤 처리
  useEffect(() => {
    if (isOpen && !isLoading && messages.length > 0) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
      
      if (onMarkAsRead) {
        onMarkAsRead().catch(console.error);
      }
    }
  }, [isOpen, isLoading, messages, scrollToBottom, onMarkAsRead]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
        {/* 채팅 헤더 */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden">
              <Image
                src={otherUserProfileImage}
                alt={otherUserName}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="font-medium">{otherUserName}</h3>
              <p className="text-xs text-gray-500">{otherUserRole}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 채팅 메시지 영역 */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 flex flex-col"
        >
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500">메시지를 불러오는 중...</div>
            </div>
          ) : (
            <>
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-4 mt-auto">
                  메시지가 없습니다. 첫 메시지를 보내보세요!
                </div>
              ) : (
                <div className="space-y-4 flex flex-col mt-auto">
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
                        <p className="text-sm">{message.text}</p>
                        <div className="flex items-center justify-end mt-1 space-x-1">
                          {message.status && (
                            <span 
                              className={`text-xs ${
                                message.isMine 
                                  ? message.status === 'failed' 
                                    ? 'text-red-300' 
                                    : message.status === 'sending' 
                                      ? 'text-teal-200' 
                                      : 'text-teal-100'
                                  : 'text-gray-500'
                              }`}
                            >
                              {message.status === 'failed' 
                                ? '전송 실패' 
                                : message.status === 'sending' 
                                  ? '전송 중...' 
                                  : message.status === 'sent'
                                    ? '전송됨' 
                                    : ''}
                            </span>
                          )}
                          {message.isMine && message.isRead && (
                            <span className="text-xs text-teal-300 font-medium">
                              읽음
                            </span>
                          )}
                          <span
                            className={`text-xs ${
                              message.isMine ? 'text-teal-100' : 'text-gray-500'
                            }`}
                          >
                            {formatMessageTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </>
          )}
        </div>

        {/* 메시지 입력 영역 */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요..."
              disabled={isSending}
              className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={isSending || newMessage.trim() === ''}
              className={`p-2 rounded-full transition-colors ${
                isSending || newMessage.trim() === ''
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-teal-500 text-white hover:bg-teal-600'
              }`}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 