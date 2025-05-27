import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { GoogleAnalytics } from "@next/third-parties/google"
import { Analytics } from '@vercel/analytics/react'
import "./globals.css"
import "./output.css"
import { FeedbackForm } from "@/components/feedback-form"
import { AuthProvider } from "@/contexts/auth-context"
import { Toaster } from "sonner"
import { SyncUser } from "@/app/components/sync-user"
import TokenRefresher from '@/app/components/auth/TokenRefresher'
import { Footer } from "@/components/Footer"
import { ReviewSection } from "@/components/ReviewSection"

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="naver-site-verification" content="877909cff89a029e033c97399331d77f7ca29013" />
      </head>
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`} suppressHydrationWarning={true}>
        <TokenRefresher />
        <AuthProvider>
          <SyncUser />
          <div className="flex-grow">
            {children}
          </div>
          <ReviewSection />
          <Footer />
          <FeedbackForm />
          <Toaster position="top-center" />
          <GoogleAnalytics gaId="G-XXXXXXXXXX" />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  )
}