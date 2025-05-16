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
      return data.paymentId;
    } catch (error: any) {
      toast.error('결제 초기화 중 오류가 발생했습니다.');
      return null;
    }
  };

  const pollPaymentStatus = async (paymentId: string, maxAttempts = 30): Promise<string | null> => {
    let attempts = 0;

    // ✅ 최초 4초 대기 (웹훅 도착 유예)
    console.log(`🕒 최초 대기 (웹훅 반영 기다리는 중)...`);
    await new Promise(resolve => setTimeout(resolve, 4000));

    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 폴링 시도 #${attempts + 1} - payment_id=${paymentId} 조회 시작`);
        
        const response = await fetch(`/api/payment/status?payment_id=${paymentId}`);
        const responseStatus = response.status;
        const data = await response.json();

        // 전체 응답 상세 로깅
        console.log(`🔍 상태 응답 전체 [${attempts + 1}/${maxAttempts}]:`, {
          responseStatus,
          data,
          rawDataType: typeof data,
          hasStatus: data && 'status' in data,
          statusValue: data?.status,
          statusType: typeof data?.status
        });

        console.log(`📡 [${attempts + 1}/${maxAttempts}] 결제 상태 확인:`, data);

        if (data?.status === 'DONE') return 'DONE';
        if (data?.status === 'FAILED') return 'FAILED';
        if (data?.status === 'CANCELLED') return 'CANCELLED';

      } catch (error) {
        console.warn('⚠️ 상태 확인 중 오류:', error);
      }

      // 디버깅용 정보 표시
      if (attempts >= 3 && attempts % 5 === 0) {
        console.warn(`⏱️ 아직 상태 확인 중... ${attempts + 1}/${maxAttempts} 회차`);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      attempts++;
    }

    console.warn('❌ 최대 시도 횟수 초과 - 결제 상태를 확인하지 못했습니다.');
    return null;
  };

  const isValidPhoneNumber = (phone: string) => {
    return /^(\d{10,11}|\d{3}-\d{3,4}-\d{4}|\d{2,3}-\d{3,4}-\d{4})$/.test(phone);
  };

  const handlePayment = async () => {
    if (!selectedSeats.length) return toast.error("좌석을 선택해주세요.");
    if (!isValidPhoneNumber(phoneNumber)) return toast.error("올바른 전화번호를 입력해주세요.");
    if (!STORE_ID || !INICIS_CHANNEL_KEY) return alert('결제 설정 오류입니다.');

    setWaitingPayment(true);
    const paymentId = await initiatePayment();
    if (!paymentId) {
      setWaitingPayment(false);
      return;
    }

    const paymentAmount = amount <= 0 ? 110 : amount;

    try {
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
    } catch (err: any) {
      console.warn('⚠️ SDK 오류 발생 (무시하고 상태 확인 진행):', err);
    }

    // SDK 응답과 무관하게 DB 상태로 판단
    toast.info("결제 상태를 확인 중입니다...");
    const finalStatus = await pollPaymentStatus(paymentId);

    if (finalStatus === 'DONE') {
      toast.success("결제가 완료되었습니다!");
      onSuccess?.(paymentId);
    } else if (finalStatus === 'CANCELLED') {
      toast.warning("결제가 취소되었습니다.");
      onFail?.({
        code: 'CANCELLED',
        message: '결제가 취소되었습니다.',
        isCancelled: true
      });
    } else {
      toast.error("결제가 완료되지 않았습니다.");
      onFail?.({
        code: finalStatus || 'UNKNOWN',
        message: '결제 상태 확인에 실패했습니다.',
        isCancelled: false
      });
    }

    setWaitingPayment(false);
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