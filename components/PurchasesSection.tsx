import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// Loader 컴포넌트
import { Loader as LoaderIcon } from "lucide-react";
const Loader = ({ size = 24 }: { size?: number }) => (
  <div className="animate-spin" style={{ width: size, height: size }}>
    <LoaderIcon size={size} />
  </div>
);

interface PurchasesSectionProps {
  purchases: any[];
  isLoading: boolean;
  router: AppRouterInstance;
}

export default function PurchasesSection({ purchases, isLoading, router }: PurchasesSectionProps) {
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
          <div key={item.id} className="border-b py-4 last:border-b-0">
            <h3 className="font-medium">
              {item.title !== '제목 없음' 
                ? item.title 
                : (item.post && item.post.title) 
                  || (item.post && (item.post.eventName || item.post.event_name))
                  || item.ticketTitle 
                  || item.eventName 
                  || '제목 없음'}
            </h3>
            <p className="text-sm text-gray-600">{item.date}</p>
            <p className="text-sm font-semibold">
              {typeof item.price === 'number' 
                ? item.price.toLocaleString() + '원'
                : item.price}
            </p>
            <p className="text-sm text-blue-600">{item.status}</p>
            <div className="flex mt-2 gap-2">
              <Link href={`/transaction/${item.orderNumber || item.id}`}>
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
              <Link href={`/transaction/${item.orderNumber || item.id}`}>
                <Button 
                  variant="outline" 
                  className="text-sm flex items-center gap-2 border-2 border-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors font-medium"
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
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  메시지
                </Button>
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  );
} 