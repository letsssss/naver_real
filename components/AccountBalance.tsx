import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AccountBalanceProps {
  balance: number;
  onWithdraw: () => void;
}

export default function AccountBalance({ balance, onWithdraw }: AccountBalanceProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-l-4 border-[#0061FF]">
        <h2 className="text-lg font-medium text-gray-700 mb-1">나의 예치금</h2>
        <p className="text-2xl font-bold text-[#0061FF]">{balance.toLocaleString()}원</p>
        <div className="flex justify-between items-center mt-4">
          <Link
            href="/mypage/deposit-history"
            className="text-sm text-gray-500 hover:text-[#0061FF] transition-colors"
          >
            거래내역 보기
          </Link>
          <Button
            className="bg-[#FFD600] hover:bg-[#FFE600] text-black px-5 py-2"
            onClick={onWithdraw}
          >
            출금하기
          </Button>
        </div>
      </div>
    </div>
  );
} 