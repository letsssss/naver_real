'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const supabase = createBrowserClient();
      
      // 이메일/비밀번호로 로그인
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('로그인 실패:', error);
        console.error('오류 코드:', error.status);
        console.error('오류 메시지:', error.message);
        
        // 구체적인 오류 메시지 분류
        let message = '';
        let debugInfo = `[${error.status || 'UNKNOWN'}] `;
        
        if (error.message.includes('Invalid login credentials')) {
          message = '이메일 또는 비밀번호가 틀렸습니다.';
          debugInfo += '인증 정보 불일치';
        } else if (error.message.includes('Email not confirmed')) {
          message = '이메일 인증을 완료해주세요. 인증 메일을 확인하세요.';
          debugInfo += '이메일 미인증';
        } else if (error.message.includes('Too many requests')) {
          message = '너무 많은 로그인 시도입니다. 15분 후 다시 시도해주세요.';
          debugInfo += '요청 제한 초과';
        } else if (error.message.includes('User not found')) {
          message = '등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요.';
          debugInfo += '사용자 없음';
        } else if (error.message.includes('OAuth')) {
          message = '소셜 로그인 연동 오류입니다. 관리자에게 문의하세요.';
          debugInfo += 'OAuth 오류';
        } else if (error.message.includes('redirect')) {
          message = '리디렉션 처리 중 오류가 발생했습니다.';
          debugInfo += '리디렉션 오류';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          message = '네트워크 연결을 확인해주세요.';
          debugInfo += '네트워크 오류';
        } else if (error.message.includes('timeout')) {
          message = '서버 응답 시간이 초과되었습니다. 다시 시도해주세요.';
          debugInfo += '타임아웃';
        } else if (error.message.includes('CORS')) {
          message = '브라우저 보안 정책으로 인한 오류입니다.';
          debugInfo += 'CORS 오류';
        } else {
          message = `로그인 실패: ${error.message}`;
          debugInfo += '기타 오류';
        }
        
        // 개발 환경에서는 더 상세한 정보 표시
        const isDev = process.env.NODE_ENV === 'development';
        const fullMessage = isDev ? `${message}\n\n디버그 정보: ${debugInfo}\n원본 메시지: ${error.message}` : message;
        
        setErrorMessage(fullMessage);
        toast.error(message);
        
        // 콘솔에 추가 디버깅 정보 출력
        console.group('🔍 로그인 오류 상세 정보');
        console.log('입력된 이메일:', email);
        console.log('오류 상태 코드:', error.status);
        console.log('오류 메시지:', error.message);
        console.log('디버그 분류:', debugInfo);
        console.log('전체 오류 객체:', error);
        console.groupEnd();
        
        return;
      }
      
      if (data.session) {
        console.log('✅ 로그인 성공:', data.session.user.email);
        toast.success('로그인 성공!');
        router.push('/');
      } else {
        const message = '세션 생성에 실패했습니다. 다시 시도해주세요.';
        setErrorMessage(message);
        toast.error(message);
        console.error('세션 없음:', data);
      }
    } catch (error: any) {
      console.error('로그인 중 예외 발생:', error);
      
      // 네트워크 및 기타 오류 케이스
      let message = '';
      let debugInfo = '[EXCEPTION] ';
      
      if (error.message.includes('Failed to fetch')) {
        message = '서버 연결에 실패했습니다. 네트워크를 확인해주세요.';
        debugInfo += '서버 연결 실패';
      } else if (error.message.includes('timeout')) {
        message = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
        debugInfo += '요청 타임아웃';
      } else if (error.message.includes('CORS')) {
        message = '브라우저 보안 정책으로 인한 오류입니다.';
        debugInfo += 'CORS 정책 오류';
      } else if (error.name === 'TypeError') {
        message = '클라이언트 오류가 발생했습니다. 페이지를 새로고침해주세요.';
        debugInfo += 'TypeError';
      } else {
        message = `네트워크 오류: ${error.message}`;
        debugInfo += '기타 네트워크 오류';
      }
      
      // 개발 환경에서는 더 상세한 정보 표시
      const isDev = process.env.NODE_ENV === 'development';
      const fullMessage = isDev ? `${message}\n\n디버그 정보: ${debugInfo}\n원본 메시지: ${error.message}` : message;
      
      setErrorMessage(fullMessage);
      toast.error(message);
      
      // 콘솔에 추가 디버깅 정보 출력
      console.group('🔍 로그인 예외 상세 정보');
      console.log('입력된 이메일:', email);
      console.log('예외 이름:', error.name);
      console.log('예외 메시지:', error.message);
      console.log('디버그 분류:', debugInfo);
      console.log('스택 트레이스:', error.stack);
      console.log('전체 예외 객체:', error);
      console.groupEnd();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 오류 메시지 표시 */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-red-700 whitespace-pre-line break-words">
                {errorMessage}
              </div>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded border">
                  <div className="font-semibold mb-1">개발자 정보:</div>
                  <div>• 브라우저 개발자 도구 콘솔에서 더 자세한 정보를 확인하세요</div>
                  <div>• 네트워크 탭에서 API 요청 상태를 확인하세요</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrorMessage(''); // 입력 시 오류 메시지 제거
            }}
            placeholder="your-email@example.com"
            required
            className="pl-10"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorMessage(''); // 입력 시 오류 메시지 제거
            }}
            placeholder="********"
            required
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link href="/auth/forgot-password" className="text-blue-600 hover:text-blue-800">
          비밀번호를 잊으셨나요?
        </Link>
      </div>
      
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            로그인 중...
          </>
        ) : (
          '로그인'
        )}
      </Button>
    </form>
  );
} 