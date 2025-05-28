"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, AlertCircle, Info } from "lucide-react"

interface ReportData {
  hasReports: boolean
  count: number
  severity: "low" | "medium" | "high"
  lastReportDate: string
  reasons: string[]
  status: "검토중" | "해결됨" | "무효처리"
}

interface ReportHistoryProps {
  reports: ReportData
  className?: string
}

export default function ReportHistory({ reports, className = "" }: ReportHistoryProps) {
  const [showReportDetails, setShowReportDetails] = useState(false)

  // 신고 심각도에 따른 색상 및 아이콘 설정
  const getReportSeverityStyles = () => {
    switch (reports.severity) {
      case "high":
        return {
          bgColor: "bg-red-50",
          borderColor: "border-red-300",
          textColor: "text-red-700",
          icon: <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />,
        }
      case "medium":
        return {
          bgColor: "bg-amber-50",
          borderColor: "border-amber-300",
          textColor: "text-amber-700",
          icon: <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />,
        }
      case "low":
      default:
        return {
          bgColor: "bg-blue-50",
          borderColor: "border-blue-300",
          textColor: "text-blue-700",
          icon: <Info className="h-5 w-5 text-blue-500 mr-2" />,
        }
    }
  }

  const reportStyles = getReportSeverityStyles()

  if (!reports || !reports.hasReports) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`p-4 rounded-lg border ${reportStyles.bgColor} ${reportStyles.borderColor} shadow-sm ${className}`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">{reportStyles.icon}</div>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <h4 className={`text-sm font-medium ${reportStyles.textColor}`}>
              판매자 신고 이력 ({reports.count}건)
            </h4>
            <button
              onClick={() => setShowReportDetails(!showReportDetails)}
              className="text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              {showReportDetails ? "접기" : "자세히 보기"}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">구매 전 신고 내용을 확인하세요</p>

          {showReportDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
              className="mt-3 pt-3 border-t border-gray-200"
            >
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">신고 사유:</span> {reports.reasons.join(", ")}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">최근 신고일:</span> {reports.lastReportDate}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">처리 상태:</span>{" "}
                  <span
                    className={
                      reports.status === "검토중"
                        ? "text-amber-600"
                        : reports.status === "해결됨"
                          ? "text-green-600"
                          : "text-gray-600"
                    }
                  >
                    {reports.status}
                  </span>
                </p>
                <div className="flex items-center mt-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-xs text-blue-600">
                    이지티켓은 안전한 거래를 위해 신고 내용을 검토하고 있습니다.
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
} 