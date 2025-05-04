"use client";

import { useState } from 'react';
import KakaoPay from '@/components/payment/KakaoPay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

// 좌석 옵션 인터페이스
interface SeatOption {
  id: string;
  label: string;
  price: number;
}

export default function KakaopayExamplePage() {
  const [amount, setAmount] = useState(1000);
  const [orderName, setOrderName] = useState('테스트 상품');
  const [customerName, setCustomerName] = useState('홍길동');
  const [ticketInfo, setTicketInfo] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; paymentId?: string; error?: any } | null>(null);
  
  // 예제 좌석 옵션
  const seatOptions: SeatOption[] = [
    { id: 'A1', label: 'A구역 1열', price: 500 },
    { id: 'A2', label: 'A구역 2열', price: 450 },
    { id: 'B1', label: 'B구역 1열', price: 400 },
    { id: 'B2', label: 'B구역 2열', price: 350 },
  ];
  
  const handleSuccess = (paymentId: string) => {
    setPaymentResult({
      success: true,
      paymentId,
    });
  };
  
  const handleFail = (error: any) => {
    // 사용자가 결제를 취소한 경우
    if (error.code === 'PO_SDK_CLOSE_WINDOW' || error.code === 'USER_CANCEL') {
      console.log("사용자가 결제를 취소했습니다.");
      // 취소는 결과 화면을 보여주지 않고 상태를 유지함
      return;
    }
    
    // 실제 오류가 발생한 경우에만 결과 화면 표시
    setPaymentResult({
      success: false,
      error,
    });
  };
  
  const handleReset = () => {
    setPaymentResult(null);
  };
  
  // 좌석 선택 토글 함수
  const toggleSeat = (seatId: string) => {
    setSelectedSeats(prev => 
      prev.includes(seatId) 
        ? prev.filter(id => id !== seatId) 
        : [...prev, seatId]
    );
  };
  
  // 선택된 좌석의 총 가격 계산
  const calculateTotalPrice = () => {
    return selectedSeats.reduce((total, seatId) => {
      const seat = seatOptions.find(s => s.id === seatId);
      return total + (seat?.price || 0);
    }, 0);
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
                <p><span className="font-medium">선택 좌석:</span> {selectedSeats.map(id => {
                  const seat = seatOptions.find(s => s.id === id);
                  return seat?.label;
                }).join(', ')}</p>
                <p><span className="font-medium">결제 금액:</span> {calculateTotalPrice().toLocaleString()}원</p>
                <p><span className="font-medium">연락처:</span> {phoneNumber}</p>
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
              <Label className="font-medium mb-2">좌석 선택 (필수)</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                {seatOptions.map((seat) => (
                  <div 
                    key={seat.id}
                    className={`border rounded-md p-3 cursor-pointer transition ${
                      selectedSeats.includes(seat.id) 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleSeat(seat.id)}
                  >
                    <div className="flex items-center">
                      <Checkbox
                        id={`seat-${seat.id}`}
                        checked={selectedSeats.includes(seat.id)}
                        onCheckedChange={() => toggleSeat(seat.id)}
                      />
                      <label
                        htmlFor={`seat-${seat.id}`}
                        className="text-sm font-medium leading-none ml-2 cursor-pointer"
                      >
                        {seat.label}
                      </label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 ml-6">{seat.price.toLocaleString()}원</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                선택된 좌석: {selectedSeats.length}개 (총 {calculateTotalPrice().toLocaleString()}원)
              </p>
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
              <Label htmlFor="phoneNumber">연락처</Label>
              <Input 
                id="phoneNumber" 
                type="tel" 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)} 
                placeholder="010-1234-5678"
                required
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
              amount={calculateTotalPrice() || 1000}
              orderName={orderName}
              customerName={customerName}
              ticketInfo={ticketInfo}
              phoneNumber={phoneNumber}
              selectedSeats={selectedSeats}
              onSuccess={handleSuccess}
              onFail={handleFail}
            />
          </CardFooter>
        </Card>
      )}
      
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-lg font-medium mb-2">사용 방법</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>좌석을 하나 이상 선택합니다.</li>
          <li>결제 정보를 입력합니다.</li>
          <li>연락처를 필수로 입력합니다.</li>
          <li>"카카오페이로 결제하기" 버튼을 클릭합니다.</li>
          <li>카카오페이 결제창이 열리면 결제를 진행합니다.</li>
          <li>결제 완료 후, 웹훅을 통해 서버에서 결제 정보를 검증합니다.</li>
          <li>실제 환경에서는 검증 후 DB에 주문 정보를 저장합니다.</li>
        </ol>
      </div>
    </div>
  );
} 