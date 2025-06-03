// lib/supabase.ts
'use client';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { Session } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 클라이언트 사이드에서만 실행되는지 확인하는 함수
const isClient = () => {
  return typeof window !== 'undefined';
};

// Supabase 클라이언트 타입
type SupabaseClientType = ReturnType<typeof createClient<Database>>;

class SupabaseClient {
  private static instance: SupabaseClientType | null = null;
  private static subscriptions: Map<string, { channel: any; count: number }> = new Map();

  private constructor() {}

  public static getInstance(): SupabaseClientType {
    if (!SupabaseClient.instance) {
      SupabaseClient.instance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });

      // 연결 상태 모니터링
      SupabaseClient.instance.auth.onAuthStateChange((event, session) => {
        console.log('Supabase auth state changed:', event, session?.user?.id);
      });
    }

    return SupabaseClient.instance;
  }

  // 채널 구독 관리
  public static subscribeToChannel(channelId: string, callback: (channel: any) => void): void {
    const existing = this.subscriptions.get(channelId);
    if (existing) {
      existing.count++;
      callback(existing.channel);
      return;
    }

    const channel = this.getInstance()
      .channel(channelId)
      .on('presence', { event: 'sync' }, () => {
        console.log('Channel presence sync:', channelId);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Channel presence join:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Channel presence leave:', key, leftPresences);
      })
      .subscribe((status: string) => {
        console.log(`Channel ${channelId} status:`, status);
      });

    this.subscriptions.set(channelId, { channel, count: 1 });
    callback(channel);
  }

  // 채널 구독 해제
  public static unsubscribeFromChannel(channelId: string): void {
    const subscription = this.subscriptions.get(channelId);
    if (!subscription) return;

    subscription.count--;
    if (subscription.count <= 0) {
      subscription.channel.unsubscribe();
      this.subscriptions.delete(channelId);
    }
  }

  // 모든 채널 구독 해제
  public static unsubscribeAll(): void {
    this.subscriptions.forEach(({ channel }) => {
      channel.unsubscribe();
    });
    this.subscriptions.clear();
  }

  // 연결 상태 확인
  public static async checkConnection(): Promise<boolean> {
    try {
      const { error } = await this.getInstance().from('health_check').select('count').single();
      return !error;
    } catch (error) {
      console.error('Supabase connection check failed:', error);
      return false;
    }
  }

  // 클라이언트 재설정
  public static reset(): void {
    this.unsubscribeAll();
    this.instance = null;
  }
}

class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClientType;
  private authClient: SupabaseClientType | null = null;

  private constructor() {
    // 기본 클라이언트 생성
    this.client = SupabaseClient.getInstance();
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // 기본 클라이언트 가져오기
  public getClient(): SupabaseClientType {
    return this.client;
  }

  // 세션 정보 가져오기
  private async getStoredSession() {
    if (!isClient()) return null;
    
    try {
      // 먼저 Supabase의 내장 세션 확인
      const { data: { session }, error } = await this.client.auth.getSession();
      if (session) return session;

      // 내장 세션이 없다면 localStorage 확인
      const localSession = localStorage.getItem('session');
      if (localSession) {
        const parsedSession = JSON.parse(localSession);
        // 세션이 있으면 Supabase 클라이언트에 설정
        if (parsedSession?.access_token) {
          await this.client.auth.setSession({
            access_token: parsedSession.access_token,
            refresh_token: parsedSession.refresh_token,
          });
          // 새로운 세션 반환
          const { data: { session: newSession } } = await this.client.auth.getSession();
          return newSession;
        }
      }
      
      return null;
    } catch (error) {
      console.error('세션 정보를 불러오는 중 오류 발생:', error);
      return null;
    }
  }

  // 인증된 클라이언트 가져오기
  public async getAuthClient(): Promise<SupabaseClientType> {
    if (!isClient()) {
      console.warn('getAuthClient는 클라이언트 사이드에서만 사용할 수 있습니다.');
      return this.client;
    }

    try {
      const session = await this.getStoredSession();
      
      // 이미 인증된 클라이언트가 있으면 재사용
      if (this.authClient) {
        return this.authClient;
      }

      // 세션이 있으면 인증된 클라이언트 생성
      if (session) {
        await this.client.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        this.authClient = this.client;
        return this.authClient;
      }

      // 세션이 없으면 기본 클라이언트 반환
      console.debug('인증되지 않은 상태입니다. 기본 클라이언트를 사용합니다.');
      return this.client;
    } catch (error) {
      console.error('인증된 클라이언트 초기화 중 오류 발생:', error);
      return this.client;
    }
  }

  // 세션 이벤트 리스너 등록
  public onSessionChange(callback: (event: { event: string; session: Session | null }) => void) {
    try {
      const {
        data: { subscription },
      } = this.client.auth.onAuthStateChange((event, session) => {
        //console.log('[세션 변경 감지]', event, session?.user?.id);
        callback({ event, session });
      });

      return () => {
        console.log('[세션 리스너 정리]');
        subscription?.unsubscribe();
      };
    } catch (error) {
      console.error('[세션 리스너 등록 중 오류]', error);
      return () => {};
    }
  }

  // 세션 갱신
  public async refreshSession() {
    try {
      const { data: { session }, error } = await this.client.auth.getSession();
      if (error) throw error;
      
      if (!session && isClient()) {
        // 세션이 없으면 로컬스토리지의 사용자 정보로 anonymous 세션 생성
        const localUser = localStorage.getItem('user');
        if (localUser) {
          const user = JSON.parse(localUser);
          const { data: { session: anonSession }, error: signInError } = 
            await this.client.auth.signInWithPassword({
              email: user.email,
              password: user.id, // 임시 비밀번호로 ID 사용
            });
            
          if (signInError) throw signInError;
          return anonSession;
        }
      }
      
      return session;
    } catch (error) {
      console.error('[세션 갱신 실패]', error);
      return null;
    }
  }
}

// 싱글톤 인스턴스 export
export const supabaseService = SupabaseService.getInstance();

// 편의를 위한 기본 클라이언트 export
export const supabase = supabaseService.getClient();

// 인증된 클라이언트를 가져오는 함수 export
export const getSupabaseClient = () => supabaseService.getAuthClient();

// 편의를 위한 함수
export const subscribeToChannel = (channelId: string, callback: (channel: any) => void) => 
  SupabaseClient.subscribeToChannel(channelId, callback);
export const unsubscribeFromChannel = (channelId: string) => 
  SupabaseClient.unsubscribeFromChannel(channelId);
export const checkSupabaseConnection = () => 
  SupabaseClient.checkConnection();
export const resetSupabaseClient = () => 
  SupabaseClient.reset();
