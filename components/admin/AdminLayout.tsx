"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 왼쪽 고정 메뉴 */}
      <aside className="w-64 bg-white border-r p-4 shadow-sm">
        <div className="mb-6">
          <Link href="/admin" className="text-xl font-bold text-blue-600">
            이지티켓 관리자
          </Link>
        </div>
        
        <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">메인 메뉴</h2>
        <ul className="space-y-3 text-sm">
          <li>
            <Link
              href="/admin"
              className={`flex items-center p-2 rounded-lg ${
                pathname === "/admin" 
                  ? "bg-blue-50 text-blue-600 font-medium" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-3" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                />
              </svg>
              대시보드
            </Link>
          </li>
          <li>
            <Link
              href="/admin/fee"
              className={`flex items-center p-2 rounded-lg ${
                pathname === "/admin/fee" 
                  ? "bg-blue-50 text-blue-600 font-medium" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-3" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              수수료 관리
            </Link>
          </li>
          <li>
            <Link
              href="/admin/reports"
              className={`flex items-center p-2 rounded-lg ${
                pathname === "/admin/reports" 
                  ? "bg-blue-50 text-blue-600 font-medium" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-3" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
              신고 관리
            </Link>
          </li>
        </ul>
        
        <div className="mt-8 pt-4 border-t border-gray-200">
          <Link
            href="/"
            className="flex items-center p-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 mr-3" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M11 17l-5-5m0 0l5-5m-5 5h12" 
              />
            </svg>
            메인 사이트로 돌아가기
          </Link>
        </div>
      </aside>

      {/* 오른쪽 본문 */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
} 