import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import SaleStatusBadge from "./SaleStatusBadge";
import MessageButton from "./MessageButton";
import ChatModal from "./chat/ChatModal";
import { toast } from "sonner";

// 판매 중인 상품 타입 정의
export type Sale = {
  id: number;
  title: string;
  date: string;
  price: string | number;
  status: string;
  isActive?: boolean;
  sortPriority?: number;
  orderNumber?: string;
  ticket_price?: string | number;
  transaction_type?: 'direct_purchase' | 'proposal_based'; // 거래 유형 추가
};

interface SaleItemProps {
  sale: Sale;
  onDelete: (postId: number) => Promise<void>;
  router: any;
}

export default function SaleItem({ sale, onDelete, router }: SaleItemProps) {
  const [isLoading, setIsLoading] = useState(false);
  // 로컬에서 주문번호 상태 관리
  const [orderNumber, setOrderNumber] = useState<string | undefined>(sale.orderNumber);
  // 채팅 모달 상태 관리 추가
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | undefined>();
  // 채팅방 오류 처리를 위한 상태 추가
  const [chatError, setChatError] = useState<string | null>(null);

  // 컴포넌트 마운트 시 또는 상태 변경 시 주문번호 조회
  useEffect(() => {
    // 주문번호가 없고, 판매중이 아니면 주문번호 조회
    if (!orderNumber && sale.status !== "판매중") {
      fetchOrderNumber();
    }
  }, [sale.id, sale.status]);

  // 각 상품별 주문번호 로깅
  useEffect(() => {
    console.log(`💬 메시지 버튼 렌더링 - 상품: ${sale.title}, 주문번호: ${orderNumber || sale.orderNumber || '없음'}`);
  }, [sale.title, sale.orderNumber, orderNumber]);

  // 주문번호 조회 함수
  const fetchOrderNumber = async () => {
    try {
      console.log(`🔍 상품 ${sale.id}(${sale.title})의 주문번호 조회 시도`);
      setIsLoading(true);
      
      // post_id로 주문번호 조회
      const response = await fetch(`/api/purchase/from-post/${sale.id}`);
      
      if (!response.ok) {
        throw new Error("주문 정보 조회 실패");
      }
      
      const data = await response.json();
      
      if (data.order_number) {
        setOrderNumber(data.order_number);
        console.log(`📝 상품 ${sale.title}의 주문번호 조회 완료: ${data.order_number}`);
      } else {
        console.log(`❌ 상품 ${sale.title}에 대한 주문번호가 없음`);
      }
    } catch (error) {
      console.error(`❌ 주문번호 조회 중 오류: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 디버깅용 콘솔 로그 추가
  console.log("💬 sale 객체:", sale);
  console.log("💰 sale.price:", sale.price);
  console.log("🏷️ sale.ticket_price:", sale.ticket_price);
  console.log("🔢 sale.orderNumber:", sale.orderNumber);
  console.log("🔢 상태에 저장된 orderNumber:", orderNumber);

  // 거래 페이지 또는 메시지 페이지로 이동
  const handleTransactionClick = async (isSeller: boolean = false) => {
    // 이미 조회된 주문번호가 있는 경우 바로 이동
    if (orderNumber) {
      const path = isSeller 
        ? `/seller/transaction/${orderNumber}` 
        : `/transaction/${orderNumber}`;
      router.push(path);
      return;
    }
    
    // 원래 sale 객체에 주문번호가 있는 경우 바로 이동
    if (sale.orderNumber) {
      const path = isSeller 
        ? `/seller/transaction/${sale.orderNumber}` 
        : `/transaction/${sale.orderNumber}`;
      router.push(path);
      return;
    }

    // 로딩 상태 설정
    setIsLoading(true);
    
    try {
      // post_id로 주문번호 조회
      const response = await fetch(`/api/purchase/from-post/${sale.id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "주문 정보를 불러오는데 실패했습니다");
      }
      
      const data = await response.json();
      
      if (!data.order_number) {
        throw new Error("주문번호가 존재하지 않습니다");
      }
      
      // 조회된 주문번호 상태 업데이트
      setOrderNumber(data.order_number);
      
      // 조회된 주문번호로 페이지 이동
      const path = isSeller 
        ? `/seller/transaction/${data.order_number}` 
        : `/transaction/${data.order_number}`;
      
      router.push(path);
    } catch (error) {
      console.error("주문 정보 조회 오류:", error);
      alert(error instanceof Error ? error.message : "주문 정보를 불러오는데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  // 간단한 채팅 모달 열기/닫기 함수
  const openChat = () => {
    const roomId = orderNumber || sale.orderNumber;
    console.log("채팅방 열기 요청 - roomId:", roomId);
    
    if (!roomId) {
      // 주문번호가 없는 경우 거래 상세 페이지로 이동하도록 안내
      toast.error("채팅 기능을 사용할 수 없습니다", {
        description: "거래 상세 보기 버튼을 클릭하여 상세 페이지에서 메시지 기능을 이용해주세요.",
        duration: 5000
      });
      return;
    }
    
    setChatRoomId(roomId);
    setIsChatOpen(true);
  }
  
  const closeChat = () => {
    setIsChatOpen(false);
    // 채팅방 닫을 때 에러 상태도 초기화
    setChatError(null);
  }
  
  // 채팅 오류 처리 함수
  const handleChatError = (error: string) => {
    console.error("채팅 오류:", error);
    setChatError(error);
    setIsChatOpen(false);
    
    // 사용자에게 오류 메시지와 대안 제시
    toast.error("채팅방을 열 수 없습니다", {
      description: "거래 상세 보기 버튼을 클릭하여 상세 페이지에서 메시지 기능을 이용해주세요.",
      duration: 5000
    });
  }

  return (
    <div className="border-b py-4 last:border-b-0">
      <div className="flex justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{sale.title}</h3>
          {/* 거래 유형 배지 추가 */}
          {sale.transaction_type && (
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
              sale.transaction_type === 'proposal_based'
                ? 'bg-orange-100 text-orange-700 border border-orange-200'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {sale.transaction_type === 'proposal_based' ? '제안 수락' : '직접 판매'}
            </span>
          )}
        </div>
        <SaleStatusBadge status={sale.status} isActive={Boolean(orderNumber || sale.orderNumber)} />
      </div>
      <p className="text-sm text-gray-600">{sale.date}</p>
      <p className="text-sm font-semibold">
        {/* 가격 표시 로직 강화 */}
        {typeof sale.price === 'string' ? sale.price : 
         typeof sale.price === 'number' ? `${sale.price.toLocaleString()}원` : 
         sale.ticket_price ? `${Number(sale.ticket_price).toLocaleString()}원` : 
         '가격 정보 없음'}
      </p>
      
      <div className="flex mt-2 justify-between items-center">
        <div className="flex gap-2">
          {/* 판매중 상태이거나 거래가 있는 경우 버튼 표시 */}
          {(sale.status !== "판매중" || Boolean(orderNumber || sale.orderNumber)) && (
            <>
              <Button 
                className="text-sm bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 transition-colors flex items-center gap-1 font-medium" 
                variant="outline"
                onClick={() => handleTransactionClick(true)} 
                disabled={isLoading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                {isLoading ? "로딩 중..." : "거래 상세 보기"}
              </Button>
              {/* 간단한 메시지 버튼 - 거래 상세 페이지에서 복사 */}
              <MessageButton 
                orderNumber={orderNumber || sale.orderNumber}
                onClick={openChat}
                isLoading={isLoading}
                debug={true}
              />
            </>
          )}
        </div>
        {sale.status === "판매중" && !sale.orderNumber && !orderNumber && (
          <AlertDialog>
            <AlertDialogTrigger>
              <div 
                className="text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded cursor-pointer inline-flex items-center justify-center font-medium"
              >
                삭제
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>판매 상품 삭제</AlertDialogTitle>
                <AlertDialogDescription>
                  이 상품을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(sale.id)}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        
        {/* 취켓팅 진행중 상태인 경우 예매 포기하기 버튼 추가 */}
        {(sale.status === "취켓팅 진행중" || sale.status === "취켓팅진행중") && (
          <AlertDialog>
            <AlertDialogTrigger>
              <div 
                className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded cursor-pointer inline-flex items-center justify-center font-medium"
              >
                예매 포기하기
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>예매 포기하기</AlertDialogTitle>
                <AlertDialogDescription>
                  정말 취켓팅을 포기하시겠습니까? 이 작업은 되돌릴 수 없으며, 구매자에게 알림이 전송됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(sale.id)}>예매 포기하기</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      
      {/* 채팅 모달 - 간단하게 구현 */}
      {isChatOpen && chatRoomId && (
        <ChatModal 
          roomId={chatRoomId} 
          onClose={closeChat}
          onError={handleChatError}
        />
      )}
    </div>
  );
} 