import React from 'react';

interface TransactionStatus {
  취켓팅진행중: number;
  판매중인상품: number;
  취켓팅완료: number;
  거래완료: number;
  거래취소: number;
}

interface StatusSummarySectionProps {
  purchaseStatus: TransactionStatus;
  saleStatus: TransactionStatus;
}

export default function StatusSummarySection({ purchaseStatus, saleStatus }: StatusSummarySectionProps) {
  // 상태 카운트가 undefined인 경우 0으로 처리
  const getStatusCount = (status: TransactionStatus, key: keyof TransactionStatus) => {
    return status[key] || 0;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
        <h2 className="text-lg font-semibold mb-4">
          최근 구매 현황 <span className="text-sm font-normal text-gray-500">(최근 1개월 기준)</span>
        </h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">취켓팅 진행중</span>
            <span className="text-2xl font-bold">{getStatusCount(purchaseStatus, '취켓팅진행중')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">취켓팅 완료</span>
            <span className="text-2xl font-bold">{getStatusCount(purchaseStatus, '취켓팅완료')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">거래완료</span>
            <span className="text-2xl font-bold">{getStatusCount(purchaseStatus, '거래완료')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">거래취소</span>
            <span className="text-2xl font-bold">{getStatusCount(purchaseStatus, '거래취소')}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
        <h2 className="text-lg font-semibold mb-4">
          최근 판매 현황 <span className="text-sm font-normal text-gray-500">(최근 1개월 기준)</span>
        </h2>
        <div className="grid grid-cols-5 gap-4 text-center relative">
          <div className="absolute left-[calc(20%-1px)] top-1 bottom-1 w-[2px] bg-gray-400"></div>
          
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">판매중인 상품</span>
            <span className="text-2xl font-bold">{getStatusCount(saleStatus, '판매중인상품')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">취켓팅 진행중</span>
            <span className="text-2xl font-bold">{getStatusCount(saleStatus, '취켓팅진행중')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">취켓팅 완료</span>
            <span className="text-2xl font-bold">{getStatusCount(saleStatus, '취켓팅완료')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">거래완료</span>
            <span className="text-2xl font-bold">{getStatusCount(saleStatus, '거래완료')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-600 mb-2">거래취소</span>
            <span className="text-2xl font-bold">{getStatusCount(saleStatus, '거래취소')}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 