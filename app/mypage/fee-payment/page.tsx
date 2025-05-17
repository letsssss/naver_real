"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkUnpaidFees } from '@/lib/fee-utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';

export default function FeePaymentPage() {
  const [unpaidFeesData, setUnpaidFeesData] = useState({
    hasUnpaidFees: false,
    unpaidFees: [],
    totalAmount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const router = useRouter();
  const { user } = useAuth();
  
  useEffect(() => {
    async function loadUnpaidFees() {
      try {
        setIsLoading(true);
        
        if (!user || !user.id) {
          router.push('/login?redirect=/mypage/fee-payment');
          return;
        }
        
        const feesData = await checkUnpaidFees(user.id);
        setUnpaidFeesData(feesData);
        
        // 기본적으로 모든 수수료 선택
        setSelectedFees(feesData.unpaidFees.map(fee => fee.id));
      } catch (error) {
        console.error("수수료 로딩 오류:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadUnpaidFees();
  }, [router, user]);
  
  const handleSelectAll = () => {
    setSelectedFees(unpaidFeesData.unpaidFees.map(fee => fee.id));
  };
  
  const handleDeselectAll = () => {
    setSelectedFees([]);
  };
  
  const handleToggleFee = (id: string) => {
    if (selectedFees.includes(id)) {
      setSelectedFees(selectedFees.filter(feeId => feeId !== id));
    } else {
      setSelectedFees([...selectedFees, id]);
    }
  };
  
  const getSelectedTotal = () => {
    return unpaidFeesData.unpaidFees
      .filter(fee => selectedFees.includes(fee.id))
      .reduce((sum, fee) => sum + fee.fee_amount, 0);
  };
  
  const handlePayFees = async () => {
    if (selectedFees.length === 0) {
      alert('납부할 수수료를 선택해주세요.');
      return;
    }
    
    // 결제 모듈 연동 (예: 포트원, 토스페이먼츠 등)
    alert('결제 시스템으로 연결합니다...');
    
    // 실제 구현 시에는 결제 처리 코드 추가
    // ...
    
    // 성공 시 페이지 이동
    // router.push('/mypage/fee-payment/success');
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">수수료 납부</h1>
      
      {unpaidFeesData.hasUnpaidFees ? (
        <>
          <Card className="bg-yellow-50 border border-yellow-200 p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">수수료 납부 안내</h2>
            <p className="mb-2">
              총 <span className="font-medium">{unpaidFeesData.unpaidFees.length}건</span>의 
              미납 수수료 <span className="font-medium">{unpaidFeesData.totalAmount.toLocaleString()}원</span>이 있습니다.
            </p>
            <p className="text-gray-600">
              수수료 납부가 완료되면 모든 판매 기능을 다시 이용하실 수 있습니다.
            </p>
          </Card>
          
          <div className="flex justify-between items-center mb-4">
            <div className="space-x-4">
              <Button 
                variant="outline" 
                onClick={handleSelectAll}
                className="border-gray-300"
              >
                전체 선택
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDeselectAll}
                className="border-gray-300"
              >
                전체 해제
              </Button>
            </div>
            
            <div className="text-right">
              <p className="text-lg">
                선택 금액: <span className="font-bold text-blue-600">{getSelectedTotal().toLocaleString()}원</span>
              </p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">선택</th>
                  <th className="px-6 py-3 text-left">주문번호</th>
                  <th className="px-6 py-3 text-left">거래금액</th>
                  <th className="px-6 py-3 text-left">수수료</th>
                  <th className="px-6 py-3 text-left">납부기한</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {unpaidFeesData.unpaidFees.map(fee => (
                  <tr key={fee.id} className={selectedFees.includes(fee.id) ? "bg-blue-50" : ""}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedFees.includes(fee.id)} 
                        onChange={() => handleToggleFee(fee.id)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4">{fee.order_number}</td>
                    <td className="px-6 py-4">{fee.total_price.toLocaleString()}원</td>
                    <td className="px-6 py-4 font-medium">{fee.fee_amount.toLocaleString()}원</td>
                    <td className="px-6 py-4">
                      {new Date(fee.fee_due_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end">
            <Button 
              onClick={handlePayFees}
              disabled={selectedFees.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg rounded-md"
            >
              {selectedFees.length > 0 
                ? `${getSelectedTotal().toLocaleString()}원 결제하기` 
                : '납부할 항목을 선택하세요'}
            </Button>
          </div>
        </>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <svg 
            className="w-16 h-16 text-green-500 mx-auto mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h2 className="text-2xl font-bold text-green-700 mb-4">납부할 수수료가 없습니다</h2>
          <p className="text-gray-600 mb-6">
            현재 납부해야 할 수수료가 없습니다. 판매 활동을 계속하실 수 있습니다.
          </p>
          <Button 
            onClick={() => router.push('/sell')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            티켓 판매하러 가기
          </Button>
        </div>
      )}
    </div>
  );
} 