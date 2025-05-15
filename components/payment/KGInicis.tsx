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

  const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
  const INICIS_CHANNEL_KEY = 'channel-key-0d84a866-ae26-4afa-9649-2ae0bb1f938b';

  const generatePaymentId = () => `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

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
    const paymentId = generatePaymentId();
    const paymentAmount = amount <= 0 ? 110 : amount;

    try {
      console.log('🔄 KG이니시스 결제 요청:', { STORE_ID, paymentId, amount, paymentAmount });

      const response = await PortOne.requestPayment({
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

      console.log('✅ 결제 응답:', response);

      // 🛡️ 결제 성공 조건: 모든 조건을 AND로 확인 (더 엄격하게)
      // 안전하게 결제 완료 여부를 판단하기 위해 모든 조건 필요
      const isSuccess =
        response &&
        response.paymentId &&
        response.transactionType === 'PAYMENT' &&
        (response as any).status === 'DONE' &&
        (response as any).success === true;

      if (isSuccess) {
        console.log('🎉 결제 성공:', {
          paymentId: response.paymentId,
          status: (response as any).status,
          transactionType: response.transactionType,
          success: (response as any).success
        });
        if (onSuccess) onSuccess(response.paymentId || paymentId);
      } else {
        console.warn('⚠️ 결제 실패 또는 미완료:', {
          paymentId: response?.paymentId,
          status: (response as any)?.status,
          transactionType: response?.transactionType,
          success: (response as any)?.success
        });
        
        // 디버깅을 위한 전체 응답 로깅
        console.log("📌 응답 객체 전체 확인:", JSON.stringify(response, null, 2));
        
        toast.warning("결제가 완료되지 않았습니다.");
        if (onFail) onFail({
          code: 'NOT_SUCCESS',
          message: '결제가 완료되지 않았습니다.',
          response
        });
      }

    } catch (error: any) {
      console.error('❌ 결제 중 오류 발생:', error);

      if (error.code === 'PO_SDK_CLOSE_WINDOW' || error.code === 'USER_CANCEL') {
        toast.info("결제가 취소되었습니다.");
        if (onFail) onFail({
          code: error.code,
          message: "사용자가 결제를 취소했습니다.",
          isCancelled: true
        });
      } else {
        toast.error("결제 처리 중 오류가 발생했습니다.");
        if (onFail) onFail(error);
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z" fill="currentColor" />
          </svg>
          <span>신용카드로 결제하기</span>
        </div>
      )}
    </Button>
  );
} 