import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { GoogleAnalytics } from "@next/third-parties/google"
import "./globals.css"
import "./output.css"
import { FeedbackForm } from "@/components/feedback-form"
import { AuthProvider as OldAuthProvider } from "@/contexts/auth-context"
import { Toaster } from "sonner"
import { SyncUser } from "@/app/components/sync-user"
import TokenRefresher from '@/app/components/auth/TokenRefresher'
import { Footer } from "@/components/Footer"
import { ReviewSection } from "@/components/ReviewSection"
import AuthRecoveryGate from "@/components/AuthRecoveryGate"
import { AuthProvider as SupabaseAuthProvider } from "@/lib/auth-context"
import AuthListener from "@/app/components/AuthListener"
import SessionRecovery from "@/app/components/SessionRecovery"
import { getServerClient } from "@/lib/supabase-server"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "이지티켓",
  description: "쉽고 빠른 티켓 거래 플랫폼",
  generator: 'v0.dev',
  verification: {
    other: {
      "naver-site-verification": ["877909cff89a029e033c97399331d77f7ca29013"],
    },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 서버에서 초기 사용자 정보 가져오기
  const supabase = getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  return (
    <html lang="ko">
      <head>
        <meta name="naver-site-verification" content="877909cff89a029e033c97399331d77f7ca29013" />
      </head>
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`} suppressHydrationWarning={true}>
        <TokenRefresher />
        {/* SessionRecovery 컴포넌트 추가 - URL 파라미터에서 세션 복원 */}
        <SessionRecovery />
        {/* 새로운 Supabase 인증 공급자 추가 */}
        <SupabaseAuthProvider initialUser={user}>
          {/* 기존 인증 공급자 유지 */}
          <OldAuthProvider>
            <SyncUser />
            <AuthRecoveryGate>
              <div className="flex-grow">
                {children}
              </div>
            </AuthRecoveryGate>
            <ReviewSection />
            <Footer />
            <FeedbackForm />
            <Toaster position="top-center" />
            <GoogleAnalytics gaId="G-XXXXXXXXXX" />
            {/* 세션 변경 감지를 위한 디버깅 컴포넌트 */}
            <AuthListener />
          </OldAuthProvider>
        </SupabaseAuthProvider>
      </body>
    </html>
  )
}