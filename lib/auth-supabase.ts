import { getSupabaseClient } from './supabase';
import { User } from '@supabase/supabase-js';
import { getResetPasswordUrl } from './domain-config';

// 사용자 회원가입
export async function signUp(email: string, password: string, name: string) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          full_name: name
        }
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('회원가입 에러:', error);
    throw error;
  }
}

// 사용자 로그인
export async function signIn(email: string, password: string) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('로그인 에러:', error);
    throw error;
  }
}

// 사용자 로그아웃
export async function signOut() {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('로그아웃 에러:', error);
    throw error;
  }
}

// 현재 사용자 정보 가져오기
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('사용자 정보 가져오기 에러:', error);
    return null;
  }
}

// 사용자 정보 업데이트
export async function updateUserProfile(userData: { name?: string, profileImage?: string, phoneNumber?: string }) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({
      data: userData
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('사용자 정보 업데이트 에러:', error);
    throw error;
  }
}

// 비밀번호 재설정 이메일 전송
export async function resetPassword(email: string) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getResetPasswordUrl(),
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('비밀번호 재설정 이메일 전송 에러:', error);
    throw error;
  }
}

// 비밀번호 변경
export async function changePassword(newPassword: string) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('비밀번호 변경 에러:', error);
    throw error;
  }
}

export async function getAuthenticatedUser() {
  const supabase = await getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession() {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
} 