import { getSupabaseClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

class AuthStatusManager {
  private static instance: AuthStatusManager;
  private lastCheck: number = 0;
  private checkInterval: number = 1000; // 1초
  private currentUser: User | null = null;
  private isChecking: boolean = false;

  private constructor() {}

  public static getInstance(): AuthStatusManager {
    if (!AuthStatusManager.instance) {
      AuthStatusManager.instance = new AuthStatusManager();
    }
    return AuthStatusManager.instance;
  }

  private async performCheck(): Promise<{ isAuthenticated: boolean; error?: string }> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { isAuthenticated: false, error: 'Supabase 클라이언트 초기화 실패' };
      }

      //const { data: { session } } = await supabase.auth.getSession();
      const session = localStorage.getItem("session");

      if (!session) {
        console.error('세션을 찾을 수 없습니다.');
        return { isAuthenticated: false, error: '로그인이 필요합니다.' };
      }

      // 세션이 있으면 사용자 정보 업데이트
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr) as User;
        this.currentUser = user;
        return { isAuthenticated: true };
      }

      return { isAuthenticated: false, error: '유효하지 않은 세션' };
    } catch (error) {
      console.error('인증 상태 확인 중 오류:', error);
      return { 
        isAuthenticated: false, 
        error: error instanceof Error ? error.message : '인증 상태 확인 중 오류 발생' 
      };
    }
  }

  public async checkAuthStatus(): Promise<{ isAuthenticated: boolean; error?: string }> {
    // 이미 체크 중이면 대기
    if (this.isChecking) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.checkAuthStatus();
    }

    // 마지막 체크로부터 일정 시간이 지나지 않았으면 캐시된 결과 반환
    const now = Date.now();
    if (now - this.lastCheck < this.checkInterval) {
      return { isAuthenticated: !!this.currentUser };
    }

    this.isChecking = true;
    try {
      const result = await this.performCheck();
      this.lastCheck = now;
      return result;
    } finally {
      this.isChecking = false;
    }
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public clearStatus(): void {
    this.currentUser = null;
    this.lastCheck = 0;
  }
}

export const authStatusManager = AuthStatusManager.getInstance(); 