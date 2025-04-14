import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import SaleStatusBadge from "./SaleStatusBadge";

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
};

interface SaleItemProps {
  sale: Sale;
  onDelete: (postId: number) => Promise<void>;
}

export default function SaleItem({ sale, onDelete }: SaleItemProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // 거래 페이지 또는 메시지 페이지로 이동
  const handleTransactionClick = async (isSeller: boolean = false) => {
    // 이미 orderNumber가 있는 경우 바로 이동
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

  return (
    <div className="border-b py-4 last:border-b-0">
      <div className="flex justify-between mb-1">
        <h3 className="font-medium">{sale.title}</h3>
        <SaleStatusBadge status={sale.status} isActive={Boolean(sale.orderNumber)} />
      </div>
      <p className="text-sm text-gray-600">{sale.date}</p>
      <p className="text-sm font-semibold">
        {sale.price}
      </p>
      
      <div className="flex mt-2 justify-between items-center">
        <div className="flex gap-2">
          {/* 판매중 상태가 아닌 경우에만 "거래상세보기"와 "메시지" 버튼 표시 */}
          {sale.status !== "판매중" && (
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
              <Button 
                variant="outline" 
                className="text-sm flex items-center gap-2 border-2 border-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors font-medium"
                onClick={() => handleTransactionClick(false)}
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
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {isLoading ? "로딩 중..." : "메시지"}
              </Button>
            </>
          )}
        </div>
        {sale.status === "판매중" && (
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
      </div>
    </div>
  );
} 