import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader as LoaderIcon } from "lucide-react";
import SaleItem from "./SaleItem";

// Loader 컴포넌트
const Loader = ({ size = 24 }: { size?: number }) => (
  <div className="animate-spin" style={{ width: size, height: size }}>
    <LoaderIcon size={size} />
  </div>
);

// 판매 중인 상품 타입 정의
interface Sale {
  id: number;
  orderNumber?: string;
  title: string;
  date: string;
  price: string;
  status: string;
  isActive: boolean;
  sortPriority: number;
}

// 상태 카운트 타입 정의
interface TransactionStatus {
  취켓팅진행중: number;
  판매중인상품: number;
  취켓팅완료: number;
  거래완료: number;
  거래취소: number;
}

interface SalesSectionProps {
  sales: Sale[];
  isLoading: boolean;
  saleStatus: TransactionStatus;
  showOnlyActive: boolean;
  setShowOnlyActive: (value: boolean) => void;
  router: AppRouterInstance;
  deletePost: (postId: number) => Promise<void>;
}

export default function SalesSection({
  sales,
  isLoading,
  saleStatus,
  showOnlyActive,
  setShowOnlyActive,
  router,
  deletePost
}: SalesSectionProps) {
  // 필터링 함수
  const filterActiveSales = () => {
    setShowOnlyActive(!showOnlyActive);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">판매중인 상품</h2>
        <button
          onClick={filterActiveSales}
          className={`px-3 py-1 rounded text-sm flex items-center ${
            showOnlyActive 
              ? "bg-blue-500 text-white" 
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {showOnlyActive ? "전체 상품 보기" : "판매 가능한 상품만 보기 (" + saleStatus.판매중인상품 + ")"}
        </button>
      </div>
      {isLoading ? (
        <div className="text-center py-8"><Loader size={30} /></div>
      ) : sales.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">판매 중인 티켓이 없습니다</p>
          <Button
            onClick={() => router.push('/sell')}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
          >
            티켓 판매하러 가기
          </Button>
        </div>
      ) : (
        sales.map((sale) => (
          <SaleItem 
            key={sale.id} 
            sale={sale} 
            onDelete={deletePost} 
            router={router} 
          />
        ))
      )}
    </div>
  );
} 