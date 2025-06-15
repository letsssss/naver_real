'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, User } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { NotificationDropdown } from '@/components/notification-dropdown'

interface MobileHeaderProps {
  mounted: boolean
}

export default function MobileHeader({ mounted }: MobileHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleLogin = () => {
    router.push("/login")
    setIsMenuOpen(false)
  }

  const handleSignOut = () => {
    signOut()
    setIsMenuOpen(false)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <>
      {/* 모바일 헤더 */}
      <header className="w-full bg-white shadow-sm relative z-40">
        <div className="flex h-16 items-center justify-between px-4">
          {/* 로고 */}
          <Link href="/" className="text-xl font-bold text-[#0061FF]" onClick={closeMenu}>
            이지티켓
          </Link>

          {/* 우측 버튼들 */}
          <div className="flex items-center space-x-3">
            {/* 알림 (로그인된 경우만) */}
            {mounted && user && (
              <div className="relative">
                <NotificationDropdown />
              </div>
            )}
            
            {/* 햄버거 메뉴 버튼 */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-700 hover:text-[#0061FF] transition-colors"
              aria-label="메뉴 열기"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 사이드 메뉴 */}
      {isMenuOpen && (
        <>
          {/* 배경 오버레이 */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={closeMenu}
          />
          
          {/* 사이드 메뉴 */}
          <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-lg z-50 transform transition-transform duration-300">
            <div className="flex flex-col h-full">
              {/* 메뉴 헤더 */}
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">메뉴</h2>
                <button
                  onClick={closeMenu}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 사용자 정보 (로그인된 경우) */}
              {mounted && user && (
                <div className="p-4 bg-gray-50 border-b">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#0061FF] rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{user.name}님</p>
                      <p className="text-sm text-gray-500">환영합니다!</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 메뉴 항목들 */}
              <div className="flex-1 overflow-y-auto">
                <nav className="p-4 space-y-2">
                  {/* 주요 메뉴 */}
                  <div className="space-y-1">
                    <Link
                      href="/proxy-ticketing"
                      className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      onClick={closeMenu}
                    >
                      <span className="text-base font-medium">대리티켓팅</span>
                    </Link>
                    
                    <Link
                      href="/ticket-cancellation"
                      className="flex items-center px-4 py-3 text-[#0061FF] bg-blue-50 rounded-lg font-medium"
                      onClick={closeMenu}
                    >
                      <span className="text-base">취켓팅</span>
                    </Link>
                    
                    <Link
                      href="/tickets"
                      className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      onClick={closeMenu}
                    >
                      <span className="text-base font-medium">티켓 구매/판매</span>
                    </Link>
                  </div>

                  {/* 구분선 */}
                  <div className="border-t my-4"></div>

                  {/* 액션 버튼들 */}
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        router.push("/ticket-request")
                        closeMenu()
                      }}
                      className="w-full px-4 py-3 bg-pink-500 text-white rounded-lg font-medium text-base hover:bg-pink-600 transition-colors"
                      style={{ backgroundColor: '#ec4899' }}
                    >
                      취켓팅 구해요
                    </button>
                    
                    <button
                      onClick={() => {
                        router.push("/sell")
                        closeMenu()
                      }}
                      className="w-full px-4 py-3 bg-[#0061FF] text-white rounded-lg font-medium text-base hover:bg-[#0052D6] transition-colors"
                    >
                      취켓팅 등록
                    </button>
                  </div>

                  {/* 로그인된 사용자 메뉴 */}
                  {mounted && user && (
                    <>
                      <div className="border-t my-4"></div>
                      <div className="space-y-1">
                        <Link
                          href="/mypage"
                          className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          onClick={closeMenu}
                        >
                          <span className="text-base font-medium">마이페이지</span>
                        </Link>
                        
                        <Link
                          href="/cart"
                          className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          onClick={closeMenu}
                        >
                          <span className="text-base font-medium">장바구니</span>
                        </Link>
                      </div>
                    </>
                  )}
                </nav>
              </div>

              {/* 하단 로그인/로그아웃 */}
              <div className="p-4 border-t">
                {mounted && user ? (
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-base font-medium"
                  >
                    로그아웃
                  </button>
                ) : mounted ? (
                  <button
                    onClick={handleLogin}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-base font-medium"
                  >
                    로그인
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
} 