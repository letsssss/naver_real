import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "./output.css"
import { FeedbackForm } from "@/components/feedback-form"
import { AuthProvider } from "@/contexts/auth-context"
import { Toaster } from "sonner"
import { SyncUser } from "@/app/components/sync-user"
import { Footer } from "@/components/Footer"
import { ReviewSection } from "@/components/ReviewSection"
import Script from 'next/script'
import { ChatProvider } from '@/contexts/chat-context'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "취켓팅 - 안전한 티켓 거래",
  description: "안전하고 편리한 티켓 거래 플랫폼",
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
        <Script id="disable-devtools-message" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined') {
              window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };
            }
          `}
        </Script>
      </head>
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`} suppressHydrationWarning={true}>
        <AuthProvider>
          <ChatProvider>
            <SyncUser />
            <div className="flex-grow">
              {children}
            </div>
            <ReviewSection />
            <Footer />
            <FeedbackForm />
            <Toaster position="top-center" />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  )
}