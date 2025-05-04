"use client";

import PortOne from '@portone/browser-sdk/v2';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

interface KakaoPayProps {
  amount: number;
  orderName: string;
  customerName?: string;
  ticketInfo?: string;
  phoneNumber: string;
  selectedSeats?: string[];
  onSuccess?: (paymentId: string) => void;
  onFail?: (error: any) => void;
}

export default function KakaoPay({
  amount,
  orderName,
  customerName = '고객',
  ticketInfo = '',
  phoneNumber,
  selectedSeats = [],
  onSuccess,
  onFail
}: KakaoPayProps) {
  const [isWaitingPayment, setWaitingPayment] = useState(false);
  
  // 환경 변수에서 PortOne 정보 가져오기
  const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
  const CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || '';

  // 고유한 결제 ID 생성 함수
  const generatePaymentId = () => {
    return `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  };

  // 전화번호 유효성 검사 함수
  const isValidPhoneNumber = (phone: string) => {
    // 기본적인 한국 전화번호 형식 검사 (숫자만 10-11자리)
    return /^(\d{10,11}|\d{3}-\d{3,4}-\d{4}|\d{2,3}-\d{3,4}-\d{4})$/.test(phone);
  };

  const handlePayment = async () => {
    // 좌석 선택 여부 확인 추가
    if (!selectedSeats || selectedSeats.length === 0) {
      toast.error("좌석을 하나 이상 선택해주세요.");
      return;
    }

    // 전화번호 유효성 검사 추가
    if (!phoneNumber || phoneNumber.trim() === '') {
      toast.error("연락처를 입력해주세요.");
      return;
    }

    // 선택적: 전화번호 형식 검사
    if (!isValidPhoneNumber(phoneNumber)) {
      toast.error("유효한 전화번호 형식이 아닙니다. (예: 010-1234-5678)");
      return;
    }

    if (!STORE_ID || !CHANNEL_KEY) {
      console.error('PortOne 설정이 누락되었습니다. 환경 변수를 확인해주세요.');
      alert('결제 설정이 올바르지 않습니다. 관리자에게 문의해주세요.');
      return;
    }

    setWaitingPayment(true);
    const paymentId = generatePaymentId();
    
    // 최소 결제 금액을 110원으로 설정
    const minAmount = 110;
    // 실제 사용할 금액 (0원이거나 amount가 없으면 110원으로 설정)
    const paymentAmount = amount <= 0 ? minAmount : amount;
    
    try {
      console.log('🔄 결제 요청 시작:', {
        storeId: STORE_ID,
        paymentId,
        originalAmount: amount,
        paymentAmount: paymentAmount,
        phoneNumber: phoneNumber,
        selectedSeats: selectedSeats
      });
      
      await PortOne.requestPayment({
        storeId: STORE_ID,
        paymentId,
        orderName, // 공연명 - 날짜 시간 (장소)
        totalAmount: paymentAmount, // amount 대신 paymentAmount 사용
        currency: 'CURRENCY_KRW',
        channelKey: CHANNEL_KEY,
        payMethod: 'EASY_PAY',
        easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
        customer: {
          fullName: customerName,
          phoneNumber: phoneNumber
        },
        bypass: { 
          kakaopay: { 
            custom_message: ticketInfo || '티켓 구매' 
          } 
        },
        noticeUrls: [window.location.origin + '/api/payment/webhook'],
      });
      
      console.log('✅ 결제 요청 완료:', paymentId);
      if (onSuccess) onSuccess(paymentId);
    } catch (error) {
      console.error('❌ 결제 요청 중 오류 발생:', error);
      if (onFail) onFail(error);
      alert('결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setWaitingPayment(false);
    }
  };

  return (
    <Button 
      onClick={handlePayment} 
      disabled={isWaitingPayment}
      size="lg"
      className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-medium"
    >
      {isWaitingPayment ? (
        <div className="flex items-center gap-2">
          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></span>
          <span>결제 진행 중...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
            <path d="M12.5 7H11V13L16.2 16.2L17 14.9L12.5 12.2V7Z" fill="currentColor"/>
          </svg>
          <span>카카오페이로 결제하기</span>
        </div>
      )}
    </Button>
  );
} 