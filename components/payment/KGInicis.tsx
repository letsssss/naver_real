"use client";

import PortOne from '@portone/browser-sdk/v2';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

// PortOne 응답 타입 확장 정의
interface PortOneResponse {
  status: string; // 'DONE', 'PENDING' 등의 상태값
  paymentId: string;
  success?: boolean; // 결제 성공 여부(PortOne SDK에서는 정의되지 않았지만 실제로 반환됨)
  [key: string]: any; // 기타 속성들
}

interface KGInicisProps {
  amount: number;
  orderName: string;
  customerName?: string;
  customerEmail?: string;
  ticketInfo?: string;
  phoneNumber: string;
  selectedSeats?: string[];
  onSuccess?: (paymentId: string) => void;
  onFail?: (error: any) => void;
  disabled?: boolean;
}

export default function KGInicis({
  amount,
  orderName,
  customerName = '고객',
  customerEmail = 'guest@easyticket82.com',
  ticketInfo = '',
  phoneNumber,
  selectedSeats = [],
  onSuccess,
  onFail,
  disabled = false
}: KGInicisProps) {
  const [isWaitingPayment, setWaitingPayment] = useState(false);
  
  // KG이니시스 관련 정보
  const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
  const INICIS_CHANNEL_KEY = 'channel-key-0d84a866-ae26-4afa-9649-2ae0bb1f938b';
  const INICIS_MID = 'MOI7245333';

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

    if (!STORE_ID || !INICIS_CHANNEL_KEY) {
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
      console.log('🔄 KG이니시스 결제 요청 시작:', {
        storeId: STORE_ID,
        paymentId,
        originalAmount: amount,
        paymentAmount: paymentAmount,
        phoneNumber: phoneNumber,
        selectedSeats: selectedSeats
      });
      
      // PortOne 결제 요청을 간소화하여 필수 속성만 포함
      const response = await PortOne.requestPayment({
        storeId: STORE_ID,
        paymentId,
        orderName, // 공연명 - 날짜 시간 (장소)
        totalAmount: paymentAmount, // amount 대신 paymentAmount 사용
        currency: 'CURRENCY_KRW',
        channelKey: INICIS_CHANNEL_KEY,
        payMethod: 'CARD', // 신용카드 결제로 변경
        customer: {
          fullName: customerName,
          phoneNumber: phoneNumber,
          email: customerEmail
        },
        noticeUrls: [window.location.origin + '/api/payment/webhook'],
      });
      
      // 결제 응답 처리
      console.log('✅ 결제 응답:', response);
      
      // PortOne 권장 방식으로 변경: success 속성으로 결제 성공 여부 판단
      // @ts-ignore - PortOne 타입 정의에 success가 없지만 실제 응답에는 존재함
      if (response && (response.success === true || response.status === 'DONE')) {
        // @ts-ignore
        console.log("🎉 결제 성공적으로 완료됨! success:", response.success, "status:", response.status || '상태 없음');
        
        // 결제가 성공적으로 완료된 경우에만 성공 콜백 호출
        if (onSuccess) onSuccess(paymentId);
      } else {
        // success가 false이거나 없는 경우 실패로 처리
        // @ts-ignore
        console.warn("🟡 결제 실패 또는 미완료 상태:", 
          // @ts-ignore
          "success:", response?.success, 
          // @ts-ignore
          "status:", response?.status || '상태 없음'
        );
        
        // 결제는 되었는데 프론트에서 success 감지 못한 경우 로깅 (디버깅용)
        if (response) {
          console.log("📌 응답 객체 전체 확인:", JSON.stringify(response, null, 2));
        }
        
        toast.warning("결제 상태를 확인 중입니다. 결제가 완료되었으나 처리되지 않았다면 관리자에게 문의하세요.");
        
        // 명확한 오류 객체 생성하여 실패 콜백 호출
        const error = {
          code: 'PAYMENT_STATUS_UNCLEAR',
          // @ts-ignore
          message: `결제 상태가 명확하지 않습니다. success: ${response?.success}, status: ${response?.status || '상태 없음'}`,
          // @ts-ignore
          paymentStatus: response?.status,
          // 타입 오류 해결을 위해 any로 변환
          paymentSuccess: (response as any)?.success,
          response: response,
          paymentId: paymentId
        };
        
        if (onFail) onFail(error);
      }
      
    } catch (error: any) {
      console.error('❌ 결제 요청 중 오류 발생:', error);
      
      // 사용자가 결제 창을 닫았거나 취소한 경우
      if (error.code === 'PO_SDK_CLOSE_WINDOW' || error.code === 'USER_CANCEL') {
        console.log("👤 사용자가 결제를 취소했습니다. 코드:", error.code);
        toast.info("결제가 취소되었습니다. 결제 창을 닫았거나 진행을 중단했습니다.");
        
        // 명확한 취소 상태 전달을 위해 오류 객체에 취소 표시 추가
        error.isCancelled = true;
        error.cancelMessage = "사용자가 결제를 취소했습니다.";
        
        // 확실한 취소 처리를 위해 취소 시점 저장
        error.cancelledAt = Date.now();

        // 사용자 취소 시 처리할 콜백 즉시 호출
        if (onFail) {
          console.log("💬 취소 콜백 즉시 실행");
          onFail(error);
          return; // 추가 처리 방지
        }
      } else {
        toast.error("결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
      
      // 명시적으로 처리를 위해 항상 onFail 콜백을 실행합니다
      if (onFail) onFail(error);
    } finally {
      setWaitingPayment(false);
    }
  };

  return (
    <Button 
      onClick={handlePayment} 
      disabled={isWaitingPayment || disabled}
      size="lg"
      className="w-full bg-green-500 hover:bg-green-600 text-white font-medium"
    >
      {isWaitingPayment ? (
        <div className="flex items-center gap-2">
          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
          <span>결제 진행 중...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z" fill="currentColor"/>
          </svg>
          <span>신용카드로 결제하기</span>
        </div>
      )}
    </Button>
  );
} 