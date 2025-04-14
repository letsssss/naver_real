import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AccountBalance from '@/components/AccountBalance';

interface AccountSummarySectionProps {
  balance: number;
  points: number;
  pointsExpiringSoon: number;
  coupons: number;
  onWithdraw: () => void;
}

export default function AccountSummarySection({
  balance,
  points,
  pointsExpiringSoon,
  coupons,
  onWithdraw
}: AccountSummarySectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <AccountBalance balance={balance} onWithdraw={onWithdraw} />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-l-4 border-[#FF2F6E]">
          <h2 className="text-lg font-medium text-gray-700 mb-1">포인트</h2>
          <p className="text-2xl font-bold text-[#FF2F6E]">{points.toLocaleString()}P</p>
          <div className="flex justify-between items-center mt-4">
            <Link
              href="/mypage/point-history"
              className="text-sm text-gray-500 hover:text-[#FF2F6E] transition-colors"
            >
              적립/사용 내역
            </Link>
            {pointsExpiringSoon > 0 && (
              <p className="text-xs text-gray-500">30일 후 소멸 예정: {pointsExpiringSoon.toLocaleString()}P</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-l-4 border-[#FFD600]">
          <h2 className="text-lg font-medium text-gray-700 mb-1">쿠폰</h2>
          <p className="text-2xl font-bold text-[#FFD600]">{coupons}장</p>
          <div className="flex justify-between items-center mt-4">
            <Link href="/mypage/coupons" className="text-sm text-gray-500 hover:text-[#FFD600] transition-colors">
              쿠폰함 보기
            </Link>
            <Button variant="outline" className="text-gray-700 border-gray-300">
              쿠폰 등록
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 