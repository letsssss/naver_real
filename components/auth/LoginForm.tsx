"use client";

import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LoginFormProps {
  redirectTo?: string;
}

export default function LoginForm({ redirectTo = '/' }: LoginFormProps) {
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
      const supabase = await getSupabaseClient();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('로그인 실패:', error);
        
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
        } else {
          message = error.message;
          debugInfo += '기타 오류';
        }
        
        setErrorMessage(message);
        toast.error(message);
        return;
      }
      
      if (data.user) {
        console.log('✅ 로그인 성공:', data.user.email);
        toast.success('로그인 성공!');
        router.push(redirectTo);
      } else {
        const message = '세션 생성에 실패했습니다. 다시 시도해주세요.';
        setErrorMessage(message);
        toast.error(message);
      }
    } catch (error: any) {
      console.error('로그인 중 예외 발생:', error);
      const message = '로그인 처리 중 오류가 발생했습니다.';
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