"use client";

import { useState } from 'react';
import KakaoPay from '@/components/payment/KakaoPay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function KakaopayExamplePage() {
  const [amount, setAmount] = useState(1000);
  const [orderName, setOrderName] = useState('테스트 상품');
  const [customerName, setCustomerName] = useState('홍길동');
  const [ticketInfo, setTicketInfo] = useState('');
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; paymentId?: string; error?: any } | null>(null);
  
  const handleSuccess = (paymentId: string) => {
    setPaymentResult({
      success: true,
      paymentId,
    });
  };
  
  const handleFail = (error: any) => {
    setPaymentResult({
      success: false,
      error,
    });
  };
  
  const handleReset = () => {
    setPaymentResult(null);
  };
  
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-3xl font-bold mb-8">카카오페이 결제 예제</h1>
      
      {paymentResult ? (
        <Card>
          <CardHeader>
            <CardTitle>결제 {paymentResult.success ? '성공' : '실패'}</CardTitle>
            <CardDescription>
              {paymentResult.success 
                ? '결제가 성공적으로 완료되었습니다.' 
                : '결제 처리 중 오류가 발생했습니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentResult.success ? (
              <div className="space-y-2">
                <p><span className="font-medium">결제 ID:</span> {paymentResult.paymentId}</p>
                <p><span className="font-medium">상품명:</span> {orderName}</p>
                <p><span className="font-medium">결제 금액:</span> {amount.toLocaleString()}원</p>
              </div>
            ) : (
              <div className="text-red-500">
                <p>오류: {JSON.stringify(paymentResult.error)}</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleReset}>다시 시도</Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>결제 정보 입력</CardTitle>
            <CardDescription>카카오페이로 결제할 정보를 입력해주세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">결제 금액</Label>
              <Input 
                id="amount" 
                type="number" 
                min={100} 
                step={100}
                value={amount} 
                onChange={(e) => setAmount(Number(e.target.value))} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="orderName">상품명</Label>
              <Input 
                id="orderName" 
                value={orderName} 
                onChange={(e) => setOrderName(e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="customerName">고객명</Label>
              <Input 
                id="customerName" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ticketInfo">티켓 정보 (선택)</Label>
              <Input 
                id="ticketInfo" 
                value={ticketInfo} 
                onChange={(e) => setTicketInfo(e.target.value)} 
                placeholder="예: VIP석 1열 10번"
              />
            </div>
          </CardContent>
          <CardFooter>
            <KakaoPay 
              amount={amount}
              orderName={orderName}
              customerName={customerName}
              ticketInfo={ticketInfo}
              onSuccess={handleSuccess}
              onFail={handleFail}
            />
          </CardFooter>
        </Card>
      )}
      
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-lg font-medium mb-2">사용 방법</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>결제 정보를 입력합니다.</li>
          <li>"카카오페이로 결제하기" 버튼을 클릭합니다.</li>
          <li>카카오페이 결제창이 열리면 결제를 진행합니다.</li>
          <li>결제 완료 후, 웹훅을 통해 서버에서 결제 정보를 검증합니다.</li>
          <li>실제 환경에서는 검증 후 DB에 주문 정보를 저장합니다.</li>
        </ol>
      </div>
    </div>
  );
} 