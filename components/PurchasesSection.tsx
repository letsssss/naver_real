import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import MessageButton from "./MessageButton";
import { useAuth } from "@/contexts/auth-context";
import { cancelPurchase } from "@/services/mypage-service";
import { toast } from "sonner";

// UI 컴포넌트 추가
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

// Loader 컴포넌트
import { Loader as LoaderIcon, AlertTriangle } from "lucide-react";
const Loader = ({ size = 24 }: { size?: number }) => (
  <div className="animate-spin" style={{ width: size, height: size }}>
    <LoaderIcon size={size} />
  </div>
);

// 날짜 포맷팅 함수
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "날짜 정보 없음";
  
  try {
    // ISO 8601 날짜 문자열을 Date 객체로 변환
    const date = new Date(dateString);
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    // 한국 시간대로 변환 (Asia/Seoul)
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/\. /g, '-').replace(/\.$/g, '');
  } catch (error) {
    console.error('날짜 변환 오류:', error);
    return dateString || "날짜 정보 없음";
  }
};

// 구매 데이터 인터페이스 정의
interface Purchase {
  id: number;
  orderNumber?: string;
  title?: string;
  date?: string;
  price?: string | number;
  status: string;  // API에서 직접 반환되는 status
  post?: {
    title?: string;
    eventName?: string;
    event_name?: string;
  };
  ticketTitle?: string;
  eventName?: string;
}

interface PurchasesSectionProps {
  purchases: Purchase[];
  isLoading: boolean;
  router: AppRouterInstance;
  setPurchaseStatus?: any; // 옵셔널로 추가
  setOngoingPurchases?: any; // 옵셔널로 추가
}

export default function PurchasesSection({ 
  purchases, 
  isLoading, 
  router,
  setPurchaseStatus,
  setOngoingPurchases
}: PurchasesSectionProps) {
  const { user } = useAuth();
  const [cancelingOrderNumber, setCancelingOrderNumber] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // 거래 취소 처리 함수
  const handleCancelPurchase = async () => {
    if (!cancelingOrderNumber || !user || !setOngoingPurchases || !setPurchaseStatus) {
      toast.error("거래 취소에 필요한 정보가 부족합니다.");
      return;
    }

    setIsCanceling(true);
    try {
      const success = await cancelPurchase(
        user,
        cancelingOrderNumber,
        setOngoingPurchases,
        setPurchaseStatus
      );

      if (success) {
        setIsDialogOpen(false);
        toast.success("거래가 성공적으로 취소되었습니다.");
      }
    } catch (error) {
      console.error("거래 취소 실패:", error);
      toast.error("거래 취소 중 오류가 발생했습니다.");
    } finally {
      setIsCanceling(false);
      setCancelingOrderNumber(null);
    }
  };

  // 취소 버튼 클릭 핸들러
  const handleCancelButtonClick = (orderNumber: string) => {
    setCancelingOrderNumber(orderNumber);
    setIsDialogOpen(true);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">진행중인 구매</h2>
      {isLoading ? (
        <div className="text-center py-8"><Loader size={30} /></div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">구매 내역이 없습니다</p>
          <Button 
            onClick={() => router.push('/tickets')} 
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
          >
            티켓 구매하러 가기
          </Button>
        </div>
      ) : (
        purchases.map((item) => (
          <div key={item.id} className="border-b py-4 last:border-b-0 relative">
            <h3 className="font-medium">
              {item.title !== '제목 없음' 
                ? item.title 
                : (item.post && item.post.title) 
                  || (item.post && (item.post.eventName || item.post.event_name))
                  || item.ticketTitle 
                  || item.eventName 
                  || '제목 없음'}
            </h3>
            <p className="text-sm text-gray-600">{formatDate(item.date)}</p>
            <p className="text-sm font-semibold">
              {typeof item.price === 'number' 
                ? item.price.toLocaleString() + '원'
                : item.price}
            </p>
            <p className="text-sm text-blue-600">{item.status}</p>
            <div className="flex mt-2 gap-2">
              <Link href={`/transaction/${item.orderNumber || `ORDER-${item.id}`}`}>
                <Button 
                  className="text-sm bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 transition-colors flex items-center gap-1 font-medium" 
                  variant="outline"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                  거래 상세 보기
                </Button>
              </Link>
              <Link href={`/transaction/${item.orderNumber || `ORDER-${item.id}`}`}>
                <MessageButton orderNumber={item.orderNumber || `ORDER-${item.id}`} />
              </Link>
            </div>
            
            {/* 거래 취소 버튼 - 상태가 취켓팅진행중인 경우에만 표시하고 오른쪽 아래로 위치시킴 */}
            {item.status === "취켓팅진행중" && setPurchaseStatus && setOngoingPurchases && (
              <div className="flex justify-end mt-3">
                <Button 
                  className="text-sm bg-red-50 text-red-700 border-red-300 hover:bg-red-100 transition-colors flex items-center gap-1 font-medium" 
                  variant="outline"
                  onClick={() => handleCancelButtonClick(item.orderNumber || `ORDER-${item.id}`)}
                >
                  <AlertTriangle size={16} />
                  거래 취소
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      {/* 거래 취소 확인 모달 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>거래 취소 확인</DialogTitle>
            <DialogDescription>
              판매자가 3일 안에 티켓을 확보하지 못한 경우 거래를 취소할 수 있습니다.
              정말로 이 거래를 취소하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-amber-800 text-sm my-2">
            <p className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>거래 취소 후에는 되돌릴 수 없으니 신중하게 결정해주세요.</span>
            </p>
          </div>
          <DialogFooter className="flex justify-end gap-2 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                취소
              </Button>
            </DialogClose>
            <Button 
              type="button" 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleCancelPurchase}
              disabled={isCanceling}
            >
              {isCanceling ? <Loader size={16} /> : '거래 취소하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 