"use client";

import PortOne from '@portone/browser-sdk/v2';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface KGInicisProps {
  amount: number;
  orderName: string;
  customerName?: string;
  customerEmail?: string;
  ticketInfo?: string;
  phoneNumber: string;
  selectedSeats?: string[];
  userId: string;
  postId: string;
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
  userId,
  postId,
  onSuccess,
  onFail,
  disabled = false
}: KGInicisProps) {
  const [isWaitingPayment, setWaitingPayment] = useState(false);

  const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
  const INICIS_CHANNEL_KEY = 'channel-key-0d84a866-ae26-4afa-9649-2ae0bb1f938b';

  const initiatePayment = async () => {
    try {
      const paymentId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const response = await fetch("/api/payment/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          userId,
          postId,
          amount,
          selectedSeats
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '결제 초기화 실패');
      }

      const data = await response.json();
      console.log('✅ 결제 초기화 성공:', data);
      return data.paymentId;
    } catch (error: any) {
      console.error('❌ 결제 초기화 중 오류:', error);
      toast.error('결제 초기화 중 오류가 발생했습니다.');
      return null;
    }
  };

  const pollPaymentStatus = async (paymentId: string, maxAttempts = 10): Promise<string | null> => {
    console.log(`🔍 결제 상태 확인 시작: ${paymentId}`);
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/payment/status?payment_id=${paymentId}`);
        const data = await response.json();

        console.log(`📊 결제 상태 폴링 (${attempts + 1}/${maxAttempts}):`, data);
        console.log(`💡 현재 상태: ${data?.status}`);

        if (data.status === 'DONE') {
          console.log('✅ 결제 성공 확인!');
          return 'DONE';
        } else if (data.status === 'FAILED') {
          console.log('❌ 결제 실패 확인!');
          return 'FAILED';
        } else if (data.status === 'CANCELLED') {
          console.log('⚠️ 결제 취소 확인!');
          return 'CANCELLED';
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
        attempts++;
      } catch (error) {
        console.error('폴링 중 오류:', error);
        attempts++;
      }
    }

    console.log('⚠️ 결제 상태 확인 시간 초과');
    return null;
  };

  const isValidPhoneNumber = (phone: string) => {
    return /^(\d{10,11}|\d{3}-\d{3,4}-\d{4}|\d{2,3}-\d{3,4}-\d{4})$/.test(phone);
  };

  const handlePayment = async () => {
    if (!selectedSeats || selectedSeats.length === 0) {
      toast.error("좌석을 하나 이상 선택해주세요.");
      return;
    }

    if (!phoneNumber || phoneNumber.trim() === '') {
      toast.error("연락처를 입력해주세요.");
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      toast.error("유효한 전화번호 형식이 아닙니다. (예: 010-1234-5678)");
      return;
    }

    if (!STORE_ID || !INICIS_CHANNEL_KEY) {
      console.error('❌ PortOne 설정 누락');
      alert('결제 설정 오류입니다. 관리자에게 문의하세요.');
      return;
    }

    setWaitingPayment(true);

    // 1. 결제 초기화: DB에 PENDING 상태로 레코드 생성
    const paymentId = await initiatePayment();
    if (!paymentId) {
      setWaitingPayment(false);
      return;
    }

    const paymentAmount = amount <= 0 ? 110 : amount;

    try {
      console.log('🔄 KG이니시스 결제 요청:', { STORE_ID, paymentId, amount, paymentAmount });

      // 2. PortOne SDK 호출하여 결제창 표시
      await PortOne.requestPayment({
        storeId: STORE_ID,
        paymentId,
        orderName,
        totalAmount: paymentAmount,
        currency: 'CURRENCY_KRW',
        channelKey: INICIS_CHANNEL_KEY,
        payMethod: 'CARD',
        customer: {
          fullName: customerName,
          phoneNumber,
          email: customerEmail
        },
        noticeUrls: [window.location.origin + '/api/payment/webhook'],
      });

      // 3. 결제 완료 후 DB에 저장된 최종 상태로 판단 (중요!)
      toast.info("결제 상태 확인 중입니다...");
      const finalStatus = await pollPaymentStatus(paymentId);

      // 4. 최종 결제 상태에 따른 처리
      if (finalStatus === 'DONE') {
        toast.success("결제가 완료되었습니다!");
        if (onSuccess) onSuccess(paymentId);
      } else if (finalStatus === 'CANCELLED') {
        toast.warning("결제가 취소되었습니다.");
        if (onFail) onFail({
          code: 'CANCELLED',
          message: '결제가 취소되었습니다.',
          isCancelled: true
        });
      } else {
        toast.warning("결제가 완료되지 않았습니다.");
        if (onFail) onFail({
          code: finalStatus || 'TIMEOUT',
          message: '결제 확인 시간이 초과되었습니다.',
          isCancelled: false
        });
      }

    } catch (error: any) {
      console.error('🛑 결제창 표시 중 오류:', error);
      
      // ⭐ SDK 오류 발생해도 최종 상태는 폴링으로 확인
      if (error.code === 'PO_SDK_CLOSE_WINDOW' || error.code === 'USER_CANCEL') {
        console.log('사용자가 결제창을 닫았거나 취소한 것으로 보임');
        
        // 사용자가 결제창을 명시적으로 닫은 경우에만 바로 처리
        // 그 외의 경우는 폴링으로 최종 상태 확인
        toast.info("결제 상태 확인 중입니다...");
        const finalStatus = await pollPaymentStatus(paymentId);
        
        if (finalStatus === 'DONE') {
          // 드물지만 SDK에서 오류 발생해도 결제가 완료된 경우
          toast.success("결제가 완료되었습니다!");
          if (onSuccess) onSuccess(paymentId);
        } else {
          // 결제 취소 또는 실패
          toast.warning("결제가 취소되었습니다.");
          if (onFail) onFail({
            code: error.code,
            message: "사용자가 결제를 취소했습니다.",
            isCancelled: true
          });
        }
      } else {
        // 기타 SDK 오류 처리
        toast.info("결제 상태 확인 중입니다...");
        const finalStatus = await pollPaymentStatus(paymentId);
        
        if (finalStatus === 'DONE') {
          toast.success("결제가 완료되었습니다!");
          if (onSuccess) onSuccess(paymentId);
        } else {
          toast.error("결제 처리 중 오류가 발생했습니다.");
          if (onFail) onFail({
            code: error.code || 'ERROR',
            message: error.message || "결제 처리 중 오류가 발생했습니다.",
            isCancelled: false,
            error
          });
        }
      }
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z" fill="currentColor" />
          </svg>
          <span>신용카드로 결제하기</span>
        </div>
      )}
    </Button>
  );
} 