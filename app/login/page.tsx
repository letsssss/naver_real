"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import KakaoLoginButton from "@/components/KakaoLoginButton"
import { Separator } from "@/components/ui/separator"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Supabase 클라이언트 생성
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // URL 쿼리 파라미터에서 오류 메시지 확인
  useEffect(() => {
    const errorParam = searchParams.get('error')
    const errorMsg = searchParams.get('message')
    
    if (errorParam) {
      setError(`로그인 오류: ${errorParam}${errorMsg ? ` - ${errorMsg}` : ''}`)
    }
  }, [searchParams])
  
  // 소셜 로그인 처리 함수
  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      setLoading(true)
      setError(null)
      
      // 현재 URL 기반으로 리다이렉트 URL 설정
      const redirectTo = `${window.location.origin}/api/auth/callback`
      console.log(`🔐 로그인 시도 (${provider}), 리다이렉트: ${redirectTo}`)
      
      // Supabase OAuth 로그인 시작
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes: provider === 'github' ? 'user:email' : undefined,
        },
      })
      
      if (error) {
        throw error
      }
      
      // 로그인 요청 성공, 유저는 제공자의 인증 페이지로 리다이렉트됨
      console.log('🔐 소셜 로그인 리다이렉트 URL:', data.url)
      
    } catch (err: any) {
      console.error('소셜 로그인 에러:', err)
      setError(err.message || '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }
  
  // 테스트 전용: 세션 확인
  const checkSession = async () => {
    const { data, error } = await supabase.auth.getSession()
    console.log('현재 세션:', data.session, error)
    
    if (data.session) {
      router.push('/')
    } else {
      setError('로그인된 세션이 없습니다.')
    }
  }
  
  // 테스트 전용: 디버깅 페이지로 이동
  const goToDebugPage = () => {
    router.push('/debug/session')
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>로그인</CardTitle>
          <CardDescription>
            소셜 계정으로 간편하게 로그인하세요.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* 카카오 로그인 버튼 */}
          <KakaoLoginButton />
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-muted-foreground">
                또는 다른 방법으로 로그인
              </span>
            </div>
          </div>
          
          <Button
            className="w-full"
            onClick={() => handleSocialLogin('google')}
            disabled={loading}
          >
            {loading ? '로그인 처리 중...' : '구글로 로그인'}
          </Button>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSocialLogin('github')}
            disabled={loading}
          >
            {loading ? '로그인 처리 중...' : 'GitHub로 로그인'}
          </Button>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-2">
          <div className="w-full flex justify-between">
            <Button variant="ghost" size="sm" onClick={checkSession}>
              세션 확인
            </Button>
            <Button variant="ghost" size="sm" onClick={goToDebugPage}>
              세션 디버깅
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

