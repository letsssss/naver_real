import { Separator } from "@/components/ui/separator"

export function Footer() {
  return (
    <footer className="mt-auto py-6 bg-gray-50">
      <div className="container mx-auto px-4">
        <Separator className="mb-6" />
        <div className="text-sm text-gray-500">
          <p className="font-medium text-gray-700 mb-2">입금 완료 후 1 영업일 이내로 예약 확정</p>
          <ul className="space-y-1">
            <li>상호명: 이지티켓</li>
            <li>사업자등록번호: 601-15-58686</li>
            <li>대표자명: 김진성</li>
            <li>사업장 주소지: 경상남도 김해시 월산로 82-55, 1205동 304호(부곡동, 월산마을 부영아파트)</li>
            <li>전화번호: 055-311-0278, 070-8065-1536</li>
            <li>이메일: easyticket82@gmail.com</li>
          </ul>
        </div>
      </div>
    </footer>
  )
} 