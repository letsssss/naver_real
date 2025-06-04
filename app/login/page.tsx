"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Toaster, toast } from "sonner"
import { getSupabaseClient } from '@/lib/supabase'
//import SessionAuthButton from '@/app/components/auth/SessionAuthButton'
import LoginForm from "@/components/auth/LoginForm"
import KakaoLoginButton from "@/components/KakaoLoginButton"

interface LoginFormData {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/';
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: ""
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // 페이지 로드 시 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = await getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          router.push('/')
        }
      } catch (error) {
        // 세션 확인 오류 처리
      }
    }

    checkSession()
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const supabase = await getSupabaseClient()
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        router.push('/')
      }
    } catch (error) {
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 소셜 로그인 준비중 메시지 표시 함수
  const handleSocialLogin = (provider: string) => {
    toast.info(`${provider} 로그인은 현재 준비중입니다`, {
      position: 'top-center',
      duration: 3000,
      icon: '🔧'
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <Toaster position="top-center" />
      <div className="w-full max-w-md space-y-10">
        {/* Logo */}
        <div className="flex justify-center">
          <Link href="/">
            <Image
              src="/easyticket-logo.png"
              alt="이지티켓 로고"
              width={300}
              height={100}
              priority
              className="h-24 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Login Options */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">간편하게 로그인하기</h2>
          
          {/* 일반 로그인 폼 */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <LoginForm />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">또는</span>
            </div>
          </div>

          <KakaoLoginButton />

          <Link href="/signup" className="block">
            <button className="w-full py-3 border border-gray-300 rounded-md text-center text-gray-700">
              회원가입
            </button>
          </Link>
        </div>

        {/* Social Login */}
        <div className="flex justify-center space-x-12">
          <button 
            className="flex flex-col items-center group"
            onClick={() => handleSocialLogin('네이버')}
          >
            <div className="w-14 h-14 flex items-center justify-center bg-[#03C75A] rounded-full mb-2 group-hover:opacity-90 transition-opacity">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">네이버</span>
          </button>

          <button 
            className="flex flex-col items-center group"
            onClick={() => handleSocialLogin('Google')}
          >
            <div className="w-14 h-14 flex items-center justify-center border border-gray-300 rounded-full mb-2 group-hover:border-gray-400 transition-colors">
              <Image src="/placeholder.svg" alt="Google" width={28} height={28} />
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Google</span>
          </button>

          <button 
            className="flex flex-col items-center group"
            onClick={() => handleSocialLogin('Apple')}
          >
            <div className="w-14 h-14 flex items-center justify-center bg-black rounded-full mb-2 group-hover:bg-gray-900 transition-colors">
              <Image src="/placeholder.svg" alt="Apple" width={28} height={28} className="invert" />
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Apple</span>
          </button>
        </div>

        <div className="mt-6 border-t pt-4">
          <p className="text-sm text-gray-500 mb-4">JWT 토큰이 만료되었나요?</p>
          {/* <SessionAuthButton /> */}
        </div>
      </div>
    </div>
  )
}

