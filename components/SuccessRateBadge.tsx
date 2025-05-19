"use client"

import { useState, useEffect } from "react"
import { fetchTicketingSuccessRate } from "@/services/statistics-service"

interface SuccessRateBadgeProps {
  className?: string;
  staticRate?: number | string; // 정적 성공률을 직접 전달할 경우 (선택 사항)
  sellerId?: string;   // 특정 판매자 ID (선택 사항)
}

/**
 * 성공률 배지 컴포넌트
 * 동적으로 성공률을 가져와 표시하는 재사용 가능한 배지 컴포넌트입니다.
 * sellerId가 제공되면 해당 판매자의 성공률을 표시합니다.
 */
export default function SuccessRateBadge({ className, staticRate, sellerId }: SuccessRateBadgeProps) {
  const [successRate, setSuccessRate] = useState<number | string>(staticRate || 90); // 기본값은 90%
  const [isLoaded, setIsLoaded] = useState<boolean>(!!staticRate); // 정적 값이 있으면 로딩 완료

  useEffect(() => {
    // 정적 값이 제공된 경우 API 호출 생략
    if (staticRate !== undefined) return;
    
    // 성공률 가져오기
    const getSuccessRate = async () => {
      try {
        // sellerId가 제공된 경우 해당 판매자의 성공률을 가져옴
        const rate = await fetchTicketingSuccessRate(sellerId);
        setSuccessRate(rate);
      } catch (error) {
        console.error("성공률 가져오기 실패:", error);
        // 오류 시 기본값 유지
      } finally {
        setIsLoaded(true);
      }
    };

    getSuccessRate();
  }, [staticRate, sellerId]);

  // 클래스명 기본값 설정
  const badgeClassName = className || "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-500 text-white hover:bg-green-600";

  // 성공률 표시 처리
  const displaySuccessRate = () => {
    if (typeof successRate === 'number') {
      return `성공률 ${successRate}%`;
    } else {
      // "신규", "측정중", "정보없음" 등의 문자열 값 처리
      return successRate;
    }
  };

  return (
    <div className={badgeClassName}>
      {displaySuccessRate()}
    </div>
  );
} 