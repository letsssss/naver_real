import ReportHistory from "./ReportHistory"

// 사용 예시
export default function ReportHistoryExample() {
  // 신고 데이터 예시
  const reportData = {
    hasReports: true,
    count: 2,
    severity: "medium" as const, // 'low', 'medium', 'high'
    lastReportDate: "2024.05.15",
    reasons: ["가격 불일치", "응답 지연"],
    status: "검토중" as const, // '검토중', '해결됨', '무효처리'
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-lg font-semibold mb-4">신고 이력 컴포넌트 예시</h2>
      
      {/* 기본 사용법 */}
      <ReportHistory reports={reportData} />
      
      {/* 커스텀 클래스 적용 */}
      <ReportHistory 
        reports={reportData} 
        className="mt-4" 
      />
      
      {/* 신고가 없는 경우 (아무것도 렌더링되지 않음) */}
      <ReportHistory 
        reports={{
          hasReports: false,
          count: 0,
          severity: "low",
          lastReportDate: "",
          reasons: [],
          status: "해결됨"
        }} 
      />
    </div>
  )
} 