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
        
        // 카카오 OAuth 관련 오류 케이스들
        let message = '';
        if (error.message.includes('Invalid login credentials')) {
          message = '이메일 또는 비밀번호가 틀렸습니다.';
        } else if (error.message.includes('Email not confirmed')) {
          message = '이메일 인증을 완료해주세요.';
        } else if (error.message.includes('Too many requests')) {
          message = '너무 많은 시도입니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('OAuth')) {
          message = '소셜 로그인 연동 오류입니다.';
        } else if (error.message.includes('redirect')) {
          message = '리디렉션 처리 중 오류가 발생했습니다.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          message = '네트워크 연결을 확인해주세요.';
        } else {
          message = `로그인 실패: ${error.message}`;
        }
        
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      
      if (data.session) {
        toast.success('로그인 성공!');
        router.push('/');
      }
    } catch (error: any) {
      console.error('로그인 중 오류 발생:', error);
      
      // 네트워크 및 기타 오류 케이스
      let message = '';
      if (error.message.includes('Failed to fetch')) {
        message = '서버 연결에 실패했습니다. 네트워크를 확인해주세요.';
      } else if (error.message.includes('timeout')) {
        message = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
      } else if (error.message.includes('CORS')) {
        message = '브라우저 보안 정책으로 인한 오류입니다.';
      } else {
        message = `네트워크 오류: ${error.message}`;
      }
      
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 오류 메시지 표시 */}
      {errorMessage && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700">{errorMessage}</span>
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