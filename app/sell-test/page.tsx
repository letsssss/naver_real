"use client"

// 최소한의 코드로 테스트용 페이지를 생성합니다
console.log("🧪🧪🧪 SELL-TEST 파일이 로드됨");

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"

export default function SellTestPage() {
  console.log("🧪🧪 SellTestPage 함수 실행 시작");
  
  const { user, isLoading } = useAuth();
  console.log("🧪 인증 상태:", { user: !!user, id: user?.id, isLoading });
  
  const router = useRouter();
  
  useEffect(() => {
    console.log("🧪 SellTestPage useEffect 실행됨");
    console.log("🧪 User 데이터:", user);
  }, [user]);
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">판매 페이지 테스트</h1>
      <p className="mb-4">이 페이지는 라우팅 문제를 진단하기 위한 테스트 페이지입니다.</p>
      
      <div className="p-4 bg-blue-100 rounded-lg mb-4">
        <p><strong>인증 상태:</strong> {isLoading ? "로딩중..." : user ? "로그인됨" : "로그인 필요"}</p>
        {user && (
          <p><strong>사용자 ID:</strong> {user.id}</p>
        )}
      </div>
      
      <Button 
        onClick={() => router.push("/")}
        className="bg-blue-500 hover:bg-blue-700 text-white"
      >
        홈으로 돌아가기
      </Button>
    </div>
  );
} 