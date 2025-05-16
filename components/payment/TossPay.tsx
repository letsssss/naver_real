"use client";

import PortOne from '@portone/browser-sdk/v2';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TossPayProps {
  amount: number;
  orderName: string;
  customerName?: string;
  ticketInfo?: string;
  phoneNumber: string;
  selectedSeats?: string[];
  userId: string;
  postId: string;
  onSuccess?: (paymentId: string) => void;
  onFail?: (error: any) => void;
  disabled?: boolean;
}

export default function TossPay({
  amount,
  orderName,
  customerName = '고객',
  ticketInfo = '',
  phoneNumber,
  selectedSeats = [],
  userId,
  postId,
  onSuccess,
  onFail,
  disabled = false
}: TossPayProps) {
  const [isWaitingPayment, setWaitingPayment] = useState(false);
  
  const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
  const TOSS_CHANNEL_KEY = 'channel-key-655baa84-32f0-4e00-9771-523951b7aa2d';
  const TOSS_MID = 'tosstest';

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
    if (!STORE_ID || !TOSS_CHANNEL_KEY) return alert('결제 설정 오류입니다.');

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
        channelKey: TOSS_CHANNEL_KEY,
        payMethod: 'EASY_PAY',
        easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_TOSSPAY' },
        customer: {
          fullName: customerName,
          phoneNumber
        },
        bypass: { 
          toss: { 
            mid: TOSS_MID
          } 
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
      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium"
    >
      {isWaitingPayment ? (
        <div className="flex items-center gap-2">
          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
          <span>결제 진행 중...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19.3 5.71002C18.841 5.24601 18.2943 4.87797 17.6917 4.62731C17.0891 4.37666 16.4426 4.2484 15.79 4.25002C15.1373 4.2484 14.4909 4.37666 13.8883 4.62731C13.2857 4.87797 12.739 5.24601 12.28 5.71002L12 6.00002L11.72 5.72001C10.7917 4.79182 9.53261 4.27037 8.22 4.27037C6.90739 4.27037 5.64827 4.79182 4.72 5.72001C3.80332 6.65478 3.27496 7.90737 3.27496 9.21002C3.27496 10.5127 3.80332 11.7653 4.72 12.7L11.49 19.47C11.6306 19.6106 11.8212 19.6892 12.02 19.6892C12.2187 19.6892 12.4094 19.6106 12.55 19.47L19.32 12.7C20.2365 11.7629 20.7645 10.5087 20.7645 9.20502C20.7645 7.90134 20.2365 6.6471 19.32 5.71002H19.3Z" fill="currentColor"/>
          </svg>
          <span>토스페이로 결제하기</span>
        </div>
      )}
    </Button>
  );
} 