"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { Toaster } from "sonner"
import KakaoLoginButton from "@/components/KakaoLoginButton"
import SessionAuthButton from '@/app/components/auth/SessionAuthButton'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  // 이미 로그인된 경우 리다이렉트
  if (session) {
    redirect(searchParams.redirectTo || '/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <Toaster position="top-center" />
      <div className="w-full max-w-md space-y-10">
        {/* Logo */}
        <div className="flex justify-center">
          <Link href="/">
            <Image
              src="/easyticket-logo.png"
              alt="EasyTicket"
              width={300}
              height={100}
              className="h-24 object-contain cursor-pointer"
            />
          </Link>
        </div>

        {/* Login Options */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">간편하게 로그인하기</h2>
          
          <KakaoLoginButton mode="login" />

          <Link href="/signup" className="block">
            <button className="w-full py-3 border border-gray-300 rounded-md text-center text-gray-700">
              회원가입
            </button>
          </Link>
        </div>

        {/* Social Login */}
        <div className="pt-8">
          <div className="flex justify-center space-x-12">
            <button className="flex flex-col items-center group">
              <div className="w-14 h-14 flex items-center justify-center bg-[#03C75A] rounded-full mb-2 group-hover:opacity-90 transition-opacity">
                <span className="text-white font-bold text-xl">N</span>
              </div>
              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">네이버</span>
            </button>

            <button className="flex flex-col items-center group">
              <div className="w-14 h-14 flex items-center justify-center border border-gray-300 rounded-full mb-2 group-hover:border-gray-400 transition-colors">
                <Image src="/placeholder.svg" alt="Google" width={28} height={28} />
              </div>
              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Google</span>
            </button>

            <button className="flex flex-col items-center group">
              <div className="w-14 h-14 flex items-center justify-center bg-black rounded-full mb-2 group-hover:bg-gray-900 transition-colors">
                <Image src="/placeholder.svg" alt="Apple" width={28} height={28} className="invert" />
              </div>
              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Apple</span>
            </button>
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
          <p className="text-sm text-gray-500 mb-4">JWT 토큰이 만료되었나요?</p>
          <SessionAuthButton />
        </div>
      </div>
    </div>
  )
}

