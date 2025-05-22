'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getBrowserClient, setupAuthListener } from './supabase-client';

// 인증 컨텍스트 타입 정의
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
};

// 기본값으로 컨텍스트 생성
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true
});

/**
 * 인증 프로바이더 컴포넌트
 * 앱의 최상위 레벨에서 사용하여 모든 컴포넌트에 인증 상태 제공
 */
export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);

  useEffect(() => {
    console.log('🔒 Auth Provider 마운트됨');
    console.log('🔒 초기 사용자 정보:', initialUser ? `${initialUser.email} (${initialUser.id})` : '로그인 안됨');
    
    // 인증 상태 변경 리스너 설정
    const cleanup = setupAuthListener((newUser) => {
      console.log('🔒 사용자 상태 변경:', newUser ? `${newUser.email} (${newUser.id})` : '로그인 안됨');
      setUser(newUser);
      setIsLoading(false);
    });
    
    return () => {
      console.log('🔒 Auth Provider 언마운트됨');
      cleanup();
    };
  }, [initialUser]);

  const value = {
    user,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 인증 상태를 사용하기 위한 커스텀 훅
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다');
  }
  
  return context;
}

/**
 * 로그인 여부만 확인하는 간단한 훅
 * 실시간 업데이트 필요 없이 로그인 여부만 필요한 컴포넌트에서 사용
 */
export function useIsAuthenticated() {
  const { user } = useAuth();
  return user !== null;
} 