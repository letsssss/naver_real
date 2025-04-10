interface SaleStatusBadgeProps {
  status: string;
  isActive?: boolean;
}

export default function SaleStatusBadge({ status, isActive = false }: SaleStatusBadgeProps) {
  // 상태 뱃지 표시
  if (status === "취켓팅 진행중") {
    return (
      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
        취켓팅 진행중
      </span>
    );
  }
  
  if (isActive && status === "판매중") {
    return (
      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
        판매 가능
      </span>
    );
  }
  
  // 상태에 따른 텍스트 색상
  const statusColorClass = 
    status === "판매중" ? "text-green-600" : 
    status.includes("취켓팅 진행중") ? "text-blue-600 font-medium" : 
    status.includes("취켓팅") ? "text-blue-600" : 
    status === "거래완료" ? "text-purple-600" : 
    status === "거래취소" ? "text-red-600" : "text-gray-600";
  
  return <span className={`text-sm ${statusColorClass}`}>{status}</span>;
} 