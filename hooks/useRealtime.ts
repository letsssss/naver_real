import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { Database } from '@/types/supabase.types';

// 개발 환경인지 확인
const isDevelopment = process.env.NODE_ENV === 'development';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://easyticket82.com';

// 환경 변수 가져오기
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export function useRealtime() {
  const [channel, setChannel] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [supabaseAvailable, setSupabaseAvailable] = useState(true);

  // 실시간 구독 설정
  useEffect(() => {
    const initializeRealtime = async () => {
      setLoading(true);

      try {
        const supabase = await getSupabaseClient();
        
        // 사용자 정의 이벤트 핸들러
        const handleNotification = (payload: any) => {
          if (payload.new) {
            setNotifications(prev => [payload.new, ...prev]);
            
            // 개발 환경에서 확인용 로그
            if (isDevelopment) {
              console.log('실시간 알림 수신:', payload.new);
            }
          }
        };

        const handleMessage = (payload: any) => {
          if (payload.new) {
            setMessages(prev => [payload.new, ...prev]);
            
            // 개발 환경에서 확인용 로그
            if (isDevelopment) {
              console.log('실시간 메시지 수신:', payload.new);
            }
          }
        };

        try {
          // 커스텀 채널 생성 시도
          const customChannel = supabase.channel('custom-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'Notification' }, 
                handleNotification)
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'Message' }, 
                handleMessage)
            .subscribe();

          setChannel(customChannel);
          setSupabaseAvailable(true);
          
          if (isDevelopment) {
            console.log('Supabase 실시간 채널 구독 성공');
          }
        } catch (channelError) {
          console.error('Supabase 채널 생성 오류:', channelError);
          setSupabaseAvailable(false);
          
          if (isDevelopment) {
            console.log('Supabase 실시간 채널 생성 실패, 폴백 사용');
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('실시간 설정 중 오류:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setSupabaseAvailable(false);
        setLoading(false);
      }
    };

    initializeRealtime();

    // 정리 함수
    return () => {
      if (channel) {
        try {
          channel.unsubscribe();
          if (isDevelopment) {
            console.log('Supabase 채널 구독 해제');
          }
        } catch (error) {
          console.error('채널 구독 해제 오류:', error);
        }
      }
    };
  }, []);

  // 수동으로 알림 목록 갱신 - Supabase 직접 쿼리 또는 API 폴백
  const refreshNotifications = async () => {
    try {
      setLoading(true);
      
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('Notification')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        throw error;
      }

      setNotifications(data || []);
      
      if (isDevelopment) {
        console.log('Supabase 쿼리로 알림 갱신 성공:', data?.length);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('알림 목록 갱신 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  };

  // 알림을 읽음 상태로 표시 - Supabase 직접 쿼리 또는 API 폴백
  const markNotificationAsRead = async (notificationId: number) => {
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from('Notification')
        .update({ isRead: true })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }
      
      if (isDevelopment) {
        console.log('Supabase 쿼리로 알림 읽음 처리 성공:', notificationId);
      }
      
      // 로컬 상태 업데이트
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true } 
            : notification
        )
      );
      
      return;
    } catch (err) {
      console.error('알림 읽음 표시 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // 모든 알림을 읽음 상태로 표시
  const markAllNotificationsAsRead = async () => {
    try {
      // Supabase 직접 쿼리 시도
      if (supabaseAvailable && supabase) {
        try {
          console.log('Supabase로 모든 알림 읽음 처리 시도...');
          
          // 현재 알림 목록에서 읽지 않은 알림 필터링
          const unreadNotificationIds = notifications
            .filter(notification => !notification.isRead)
            .map(notification => notification.id);
            
          if (unreadNotificationIds.length === 0) {
            console.log('읽지 않은 알림이 없습니다.');
            return;
          }
          
          // Supabase에서 모든 읽지 않은 알림 업데이트
          const { error } = await supabase
            .from('Notification')
            .update({ isRead: true })
            .in('id', unreadNotificationIds);

          if (error) {
            throw error;
          }

          // 로컬 상태 업데이트
          setNotifications(prev => 
            prev.map(notification => ({ ...notification, isRead: true }))
          );
          
          if (isDevelopment) {
            console.log(`Supabase로 ${unreadNotificationIds.length}개 알림 일괄 읽음 처리 성공`);
          }
          
          return;
        } catch (supabaseError) {
          console.error('Supabase 일괄 알림 읽음 처리 오류, API 폴백으로 전환:', supabaseError);
          // API 폴백으로 진행
        }
      }
      
      // API 폴백: fetch를 사용하여 모든 알림 읽음 처리
      try {
        if (isDevelopment) {
          console.log('API 폴백으로 모든 알림 읽음 처리 중...');
        }
        
        const response = await fetch(`${apiBaseUrl}/api/notifications/mark-all-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include' // 쿠키를 포함하여 요청 전송
        });
        
        if (!response.ok) {
          throw new Error(`API 응답 오류: ${response.status}`);
        }
        
        // 로컬 상태 업데이트
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
        
        if (isDevelopment) {
          console.log('API 폴백으로 모든 알림 읽음 처리 성공');
        }
      } catch (apiError) {
        console.error('API 폴백 요청 오류:', apiError);
        setError(apiError instanceof Error ? apiError : new Error(String(apiError)));
      }
    } catch (err) {
      console.error('모든 알림 읽음 표시 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return {
    notifications,
    messages,
    loading,
    error,
    supabaseAvailable,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
  };
}

export async function refreshToken() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return data.session?.access_token;
  } catch (error) {
    console.error('토큰 갱신 오류:', error);
    return null;
  }
}

async function callAPIWithTokenRefresh(url: string, options: any = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });

    // 401 오류 발생 시 토큰 갱신 후 재시도
    if (response.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        return fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      }
    }
    return response;
  } catch (error) {
    console.error('API 호출 오류:', error);
    throw error;
  }
}

export const updateSupabaseCookieSettings = () => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      // Supabase의 내장 세션 관리 사용
      supabase.auth.setSession(session);
      console.log('✅ Supabase 세션이 자동으로 설정되었습니다');
    }
  });
};

/**
 * 요청 헤더에서 인증 토큰을 추출합니다.
 */
function getTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get('authorization');
  if (!authHeader) return null;
  
  // Bearer 토큰 형식에서 토큰 부분만 추출
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}

/**
 * 요청 쿠키에서 인증 토큰을 추출합니다.
 */
function getTokenFromCookies(request: Request | NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  // 쿠키 문자열 파싱
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [name, value] = cookie.trim().split('=');
      return [name, decodeURIComponent(value)];
    })
  );
  
  return cookies['sb-access-token'] || null;
}

export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers) || getTokenFromCookies(request);
    
    if (!token) {
      console.log("❌ 인증 토큰을 찾을 수 없습니다");
      return null;
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error("❌ 사용자 인증 실패:", error.message);
      return null;
    }

    return user;
  } catch (error) {
    console.error("❌ 인증 처리 중 오류 발생:", error);
    return null;
  }
} 