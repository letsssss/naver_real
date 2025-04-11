import { CheckCircle, Clock } from "lucide-react"

interface TicketingStatusCardProps {
  status: "in_progress" | "completed"
  message: string
  updatedAt?: string
}

export function TicketingStatusCard({ status, message, updatedAt }: TicketingStatusCardProps) {
  const isCompleted = status === "completed"
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return "정보 없음"
    
    const date = new Date(dateString)
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }
  
  return (
    <div className={`rounded-lg p-6 ${isCompleted ? "bg-green-50 border border-green-100" : "bg-blue-50 border border-blue-100"}`}>
      <div className="flex items-start">
        <div className={`p-2 rounded-full mr-4 ${isCompleted ? "bg-green-100" : "bg-blue-100"}`}>
          {isCompleted ? (
            <CheckCircle className={`h-6 w-6 ${isCompleted ? "text-green-600" : "text-blue-600"}`} />
          ) : (
            <Clock className={`h-6 w-6 ${isCompleted ? "text-green-600" : "text-blue-600"}`} />
          )}
        </div>
        <div>
          <h4 className={`font-semibold mb-1 ${isCompleted ? "text-green-800" : "text-blue-800"}`}>
            {isCompleted ? "취켓팅 완료" : "취켓팅 진행 중"}
          </h4>
          <p className={`text-sm ${isCompleted ? "text-green-700" : "text-blue-700"}`}>
            {message}
          </p>
          {updatedAt && (
            <p className={`text-xs mt-2 ${isCompleted ? "text-green-600" : "text-blue-600"}`}>
              {isCompleted ? "완료 시간" : "시작 시간"}: {formatDate(updatedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

