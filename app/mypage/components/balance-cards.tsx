"use client"

import { Button } from "@/components/ui/button"

interface BalanceCardProps {
  title: string
  amount: string
  unit: string
  accentColor: string
  historyLink: string
  historyText: string
  actionButton?: {
    text: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  additionalInfo?: string
}

function BalanceCard({
  title,
  amount,
  unit,
  accentColor,
  historyLink,
  historyText,
  actionButton,
  additionalInfo
}: BalanceCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden h-full">
      <div className={`p-6 border-l-4 h-full flex flex-col`} style={{ borderColor: accentColor }}>
        <h2 className="text-lg font-medium text-gray-700 mb-1">{title}</h2>
        <p className="text-2xl font-bold" style={{ color: accentColor }}>
          {amount}{unit}
        </p>
        <div className="flex justify-between items-center mt-auto pt-4">
          <a 
            className="text-sm text-gray-500 hover:transition-colors"
            style={{ ['&:hover' as any]: { color: accentColor } }}
            href={historyLink}
          >
            {historyText}
          </a>
          {actionButton ? (
            <Button
              onClick={actionButton.onClick}
              className={
                actionButton.variant === 'primary'
                  ? 'bg-[#FFD600] hover:bg-[#FFE600] text-black'
                  : 'border bg-background shadow-sm text-gray-700 border-gray-300'
              }
            >
              {actionButton.text}
            </Button>
          ) : additionalInfo ? (
            <p className="text-xs text-gray-500">{additionalInfo}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function BalanceCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
      <BalanceCard
        title="나의 예치금"
        amount="0"
        unit="원"
        accentColor="#0061FF"
        historyLink="/mypage/deposit-history"
        historyText="거래내역 보기"
        actionButton={{
          text: "출금하기",
          onClick: () => {},
          variant: "primary"
        }}
      />
      <BalanceCard
        title="포인트"
        amount="0"
        unit="P"
        accentColor="#FF2F6E"
        historyLink="/mypage/point-history"
        historyText="적립/사용 내역"
        additionalInfo="30일 후 소멸 예정: 0P"
      />
      <BalanceCard
        title="쿠폰"
        amount="0"
        unit="장"
        accentColor="#FFD600"
        historyLink="/mypage/coupons"
        historyText="쿠폰함 보기"
        actionButton={{
          text: "쿠폰 등록",
          onClick: () => {},
          variant: "secondary"
        }}
      />
    </div>
  )
} 