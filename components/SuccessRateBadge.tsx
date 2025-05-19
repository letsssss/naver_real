"use client"

import { useState, useEffect } from "react"
import { fetchTicketingSuccessRate } from "@/services/statistics-service"

interface SuccessRateBadgeProps {
  className?: string;
  staticRate?: number; // 정적 성공률을 직접 전달할 경우 (선택 사항)
}

/**
 * 성공률 배지 컴포넌트
 * 동적으로 성공률을 가져와 표시하는 재사용 가능한 배지 컴포넌트입니다.
 */
export default function SuccessRateBadge({ className, staticRate }: SuccessRateBadgeProps) {
  const [successRate, setSuccessRate] = useState<number>(staticRate || 98); // 기본값은 98%
  const [isLoaded, setIsLoaded] = useState<boolean>(!!staticRate); // 정적 값이 있으면 로딩 완료

  useEffect(() => {
    // 정적 값이 제공된 경우 API 호출 생략
    if (staticRate !== undefined) return;
    
    // 성공률 가져오기
    const getSuccessRate = async () => {
      try {
        const rate = await fetchTicketingSuccessRate();
        setSuccessRate(rate);
      } catch (error) {
        console.error("성공률 가져오기 실패:", error);
        // 오류 시 기본값 유지
      } finally {
        setIsLoaded(true);
      }
    };

    getSuccessRate();
  }, [staticRate]);

  // 클래스명 기본값 설정
  const badgeClassName = className || "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-500 text-white hover:bg-green-600";

  return (
    <div className={badgeClassName}>
      성공률 {successRate}%
    </div>
  );
} 