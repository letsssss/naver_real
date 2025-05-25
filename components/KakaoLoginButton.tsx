import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';
import { getAuthCallbackUrl } from '@/lib/domain-config';

type KakaoLoginButtonProps = {
  mode?: 'login' | 'signup'; // 'login' 또는 'signup' 모드 선택
  text?: string; // 버튼에 표시될 텍스트 (옵션)
  onSuccess?: () => void; // 성공 시 호출될 콜백 (옵션)
};

export default function KakaoLoginButton({ 
  mode = 'login', 
  text,
  onSuccess 
}: KakaoLoginButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  // 버튼 텍스트 결정
  const buttonText = text || (mode === 'login' ? '카카오로 로그인' : '카카오로 회원가입');

  const handleKakaoAuth = async () => {
    try {
      setIsLoading(true);
      
      // 회원가입 모드이고 단순 리디렉션을 원하는 경우
      if (mode === 'signup' && !text) {
        router.push('/signup');
        return;
      }
      
      // 실제 카카오 로그인 처리
      console.log(`카카오 ${mode === 'login' ? '로그인' : '회원가입'} 시작...`);
      
      // Supabase 클라이언트 생성
      const supabaseClient = supabase;
      
      // 카카오 OAuth 요청
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: getAuthCallbackUrl(),
          scopes: 'profile_nickname profile_image account_email', // email 스코프 추가
          queryParams: {
            'single_account': 'true' // 하나의 계정만 허용하도록 플래그 추가
          }
        }
      });

      if (error) {
        console.error('카카오 인증 에러:', error);
        
        // 카카오 OAuth 구체적 오류 케이스들
        let message = '';
        if (error.message.includes('OAuth provider not enabled')) {
          message = '카카오 로그인이 비활성화되어 있습니다. 관리자에게 문의하세요.';
        } else if (error.message.includes('redirect_uri')) {
          message = '리디렉션 URL 설정 오류입니다. 관리자에게 문의하세요.';
        } else if (error.message.includes('client_id')) {
          message = '카카오 앱 설정 오류입니다. 관리자에게 문의하세요.';
        } else if (error.message.includes('scope')) {
          message = '카카오 권한 설정 오류입니다.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          message = '네트워크 연결을 확인해주세요.';
        } else if (error.message.includes('timeout')) {
          message = '카카오 서버 응답이 지연되고 있습니다. 다시 시도해주세요.';
        } else {
          message = `카카오 인증 오류: ${error.message}`;
        }
        
        toast.error(message);
        return;
      }

      if (data?.url) {
        console.log('카카오 인증 페이지로 리디렉션:', data.url);
        
        // 카카오 인증 페이지로 리디렉션하기 전에 로컬 스토리지에 모드 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('kakao_auth_mode', mode);
        }
        
        window.location.href = data.url;
      } else {
        console.error('카카오 인증 URL이 없습니다.');
        toast.error('카카오 인증 URL을 받지 못했습니다. 다시 시도해주세요.');
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('인증 처리 중 오류 발생:', err);
      
      // catch 블록 오류 케이스들
      let message = '';
      if (err.message.includes('Failed to fetch')) {
        message = '서버 연결에 실패했습니다. 네트워크를 확인해주세요.';
      } else if (err.message.includes('CORS')) {
        message = '브라우저 보안 정책으로 인한 오류입니다.';
      } else if (err.message.includes('popup')) {
        message = '팝업이 차단되었습니다. 팝업 차단을 해제해주세요.';
      } else {
        message = `카카오 로그인 처리 중 오류: ${err.message}`;
      }
      
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleKakaoAuth}
      className="w-full flex items-center justify-center bg-yellow-400 text-black py-3 px-4 rounded-md font-medium shadow-sm"
      style={{ backgroundColor: '#FEE500' }}
      disabled={isLoading}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></span>
      ) : (
        <svg width="22" height="22" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3">
          <path d="M9 0.5625C4.03125 0.5625 0 3.71875 0 7.59375C0 10.1562 1.67188 12.3906 4.21875 13.6094L3.15625 17.0156C3.09375 17.2344 3.375 17.4062 3.5625 17.2812L7.6875 14.5312C8.125 14.5938 8.5625 14.625 9 14.625C13.9688 14.625 18 11.4688 18 7.59375C18 3.71875 13.9688 0.5625 9 0.5625Z" fill="black"/>
        </svg>
      )}
      <span className="text-base">{buttonText}</span>
    </button>
  );
} 