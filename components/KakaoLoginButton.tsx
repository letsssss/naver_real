import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';

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
          redirectTo: process.env.NODE_ENV === 'production' 
            ? 'https://www.easyticket82.com/auth/callback'
            : 'http://localhost:3000/auth/callback',
          flow: 'pkce', // ✅ 반드시 있어야 "code=" 방식으로 동작함
          scopes: 'profile_nickname profile_image account_email', // email 스코프 추가
          queryParams: {
            'prompt': 'login', // 강제 로그인 화면 표시
            'response_type': 'code', // ✅ Authorization Code Grant 방식 강제
            'single_account': 'true' // 하나의 계정만 허용하도록 플래그 추가
          }
        } as any // 타입 에러 임시 해결 - flow 옵션이 타입 정의에 없을 수 있음
      });

      if (error) {
        console.error('카카오 인증 에러:', error);
        console.error('오류 상태 코드:', error.status);
        console.error('오류 메시지:', error.message);
        
        // 카카오 OAuth 구체적 오류 케이스들
        let message = '';
        let debugInfo = `[KAKAO_OAUTH_${error.status || 'UNKNOWN'}] `;
        
        if (error.message.includes('OAuth provider not enabled')) {
          message = '카카오 로그인이 비활성화되어 있습니다. 관리자에게 문의하세요.';
          debugInfo += '카카오 OAuth 비활성화';
        } else if (error.message.includes('redirect_uri')) {
          message = '리디렉션 URL 설정 오류입니다. 관리자에게 문의하세요.';
          debugInfo += '리디렉션 URL 불일치';
        } else if (error.message.includes('client_id')) {
          message = '카카오 앱 설정 오류입니다. 관리자에게 문의하세요.';
          debugInfo += '카카오 클라이언트 ID 오류';
        } else if (error.message.includes('scope')) {
          message = '카카오 권한 설정 오류입니다. 필요한 권한이 설정되지 않았습니다.';
          debugInfo += '카카오 스코프 오류';
        } else if (error.message.includes('invalid_request')) {
          message = '카카오 OAuth 요청이 잘못되었습니다. 다시 시도해주세요.';
          debugInfo += '잘못된 OAuth 요청';
        } else if (error.message.includes('access_denied')) {
          message = '카카오 로그인이 거부되었습니다. 다시 시도해주세요.';
          debugInfo += '사용자 로그인 거부';
        } else if (error.message.includes('server_error')) {
          message = '카카오 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
          debugInfo += '카카오 서버 오류';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          message = '네트워크 연결을 확인해주세요.';
          debugInfo += '네트워크 연결 오류';
        } else if (error.message.includes('timeout')) {
          message = '카카오 서버 응답이 지연되고 있습니다. 다시 시도해주세요.';
          debugInfo += '카카오 서버 응답 지연';
        } else if (error.message.includes('CORS')) {
          message = '브라우저 보안 정책으로 인한 오류입니다.';
          debugInfo += 'CORS 정책 오류';
        } else {
          message = `카카오 인증 오류: ${error.message}`;
          debugInfo += '기타 카카오 오류';
        }
        
        // 개발 환경에서는 더 상세한 정보 표시
        const isDev = process.env.NODE_ENV === 'development';
        const fullMessage = isDev ? `${message}\n\n디버그 정보: ${debugInfo}\n원본 메시지: ${error.message}` : message;
        
        // 콘솔에 추가 디버깅 정보 출력
        console.group('🔍 카카오 로그인 오류 상세 정보');
        console.log('인증 모드:', mode);
        console.log('오류 상태 코드:', error.status);
        console.log('오류 메시지:', error.message);
        console.log('디버그 분류:', debugInfo);
        console.log('전체 오류 객체:', error);
        console.groupEnd();
        
        toast.error(isDev ? fullMessage : message);
        return;
      }

      if (data?.url) {
        console.log('✅ 카카오 인증 페이지로 리디렉션:', data.url);
        
        // 카카오 인증 페이지로 리디렉션하기 전에 로컬 스토리지에 모드 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('kakao_auth_mode', mode);
          console.log('✅ 카카오 인증 모드 저장:', mode);
        }
        
        // 성공 로깅
        console.group('✅ 카카오 OAuth 요청 성공');
        console.log('인증 모드:', mode);
        console.log('리디렉션 URL:', data.url);
        console.log('요청 시간:', new Date().toISOString());
        console.groupEnd();
        
        window.location.href = data.url;
      } else {
        console.error('❌ 카카오 인증 URL이 없습니다.');
        console.error('응답 데이터:', data);
        
        const message = '카카오 인증 URL을 받지 못했습니다. 다시 시도해주세요.';
        const debugInfo = '[KAKAO_NO_URL] 카카오 OAuth 응답에 URL 없음';
        
        // 개발 환경에서는 더 상세한 정보 표시
        const isDev = process.env.NODE_ENV === 'development';
        const fullMessage = isDev ? `${message}\n\n디버그 정보: ${debugInfo}\n응답 데이터: ${JSON.stringify(data)}` : message;
        
        toast.error(isDev ? fullMessage : message);
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('인증 처리 중 오류 발생:', err);
      
      // catch 블록 오류 케이스들
      let message = '';
      let debugInfo = '[KAKAO_EXCEPTION] ';
      
      if (err.message.includes('Failed to fetch')) {
        message = '서버 연결에 실패했습니다. 네트워크를 확인해주세요.';
        debugInfo += '서버 연결 실패';
      } else if (err.message.includes('NetworkError')) {
        message = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
        debugInfo += '네트워크 오류';
      } else if (err.message.includes('CORS')) {
        message = '브라우저 보안 정책으로 인한 오류입니다.';
        debugInfo += 'CORS 정책 오류';
      } else if (err.message.includes('popup')) {
        message = '팝업이 차단되었습니다. 팝업 차단을 해제해주세요.';
        debugInfo += '팝업 차단';
      } else if (err.message.includes('timeout')) {
        message = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
        debugInfo += '요청 타임아웃';
      } else if (err.name === 'TypeError') {
        message = '클라이언트 오류가 발생했습니다. 페이지를 새로고침해주세요.';
        debugInfo += 'TypeError';
      } else if (err.message.includes('localStorage')) {
        message = '브라우저 저장소 접근 오류입니다. 시크릿 모드를 해제해주세요.';
        debugInfo += '로컬스토리지 오류';
      } else {
        message = `카카오 로그인 처리 중 오류: ${err.message}`;
        debugInfo += '기타 예외';
      }
      
      // 개발 환경에서는 더 상세한 정보 표시
      const isDev = process.env.NODE_ENV === 'development';
      const fullMessage = isDev ? `${message}\n\n디버그 정보: ${debugInfo}\n원본 메시지: ${err.message}` : message;
      
      // 콘솔에 추가 디버깅 정보 출력
      console.group('🔍 카카오 로그인 예외 상세 정보');
      console.log('인증 모드:', mode);
      console.log('예외 이름:', err.name);
      console.log('예외 메시지:', err.message);
      console.log('디버그 분류:', debugInfo);
      console.log('스택 트레이스:', err.stack);
      console.log('전체 예외 객체:', err);
      console.groupEnd();
      
      toast.error(isDev ? fullMessage : message);
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