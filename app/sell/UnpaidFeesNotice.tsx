import { Button } from "@/components/ui/button";

interface UnpaidFeesNoticeProps {
  totalAmount: number;
  unpaidCount: number;
  oldestDueDate: Date | null;
  onPayNow: () => void;
}

/**
 * 미납 수수료 알림 컴포넌트
 * 판매자에게 미납 수수료가 있을 때 표시됩니다.
 */
export function UnpaidFeesNotice({ 
  totalAmount, 
  unpaidCount,
  oldestDueDate,
  onPayNow 
}: UnpaidFeesNoticeProps) {
  const formattedDate = oldestDueDate 
    ? oldestDueDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  
  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 shadow-md">
      <h2 className="text-2xl font-bold text-red-700 mb-4">
        판매 기능 일시 제한
      </h2>
      
      <div className="mt-4 text-gray-700">
        <p className="text-lg mb-4">
          <span className="font-semibold">{unpaidCount}건</span>의 미납 수수료(총 <span className="font-semibold text-red-600">{totalAmount.toLocaleString()}원</span>)가 있어 
          판매 기능이 일시적으로 제한되었습니다.
        </p>
        
        {oldestDueDate && (
          <p className="mb-4 text-gray-600">
            가장 오래된 미납 수수료의 납부 기한: <span className="font-medium">{formattedDate}</span>
          </p>
        )}
        
        <p className="mb-6 text-gray-600">
          판매 기능을 다시 이용하시려면 미납된 수수료를 납부해 주세요.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <Button 
            onClick={onPayNow}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md"
          >
            지금 수수료 납부하기
          </Button>
          
          <Button 
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => window.open('/help/fee-policy', '_blank')}
          >
            수수료 정책 안내
          </Button>
        </div>
      </div>
    </div>
  );
} 