"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Toaster } from "sonner"
import KakaoLoginButton from "@/components/KakaoLoginButton"

export default function Signup() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <Toaster position="top-center" />
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Link href="/">
            <Image 
              src="/easyticket-logo.png" 
              alt="이지티켓 로고" 
              width={300} 
              height={100}
              priority 
              className="h-24 w-auto object-contain cursor-pointer" 
            />
          </Link>
        </div>

        {/* Back Button */}
        <div>
          <Link href="/login" className="flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            로그인으로 돌아가기
          </Link>
        </div>

        {/* Kakao Signup Button */}
        <div className="py-6">
          <h2 className="text-2xl font-bold text-center mb-6">간편하게 가입하기</h2>
          <KakaoLoginButton mode="signup" text="카카오로 간편 가입하기" />
        </div>

        {/* Terms */}
        <div className="text-center text-sm text-gray-500">
          회원가입 시{" "}
          <Link href="#" className="text-blue-600 hover:underline">
            이용약관
          </Link>
          과{" "}
          <Link href="#" className="text-blue-600 hover:underline">
            개인정보 처리방침
          </Link>
          에 동의하게 됩니다.
        </div>
      </div>
    </div>
  )
}

