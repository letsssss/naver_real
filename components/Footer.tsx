import { Separator } from "@/components/ui/separator"

export function Footer() {
  return (
    <footer className="mt-auto py-6 bg-gray-50">
      <div className="container mx-auto px-4">
        <Separator className="mb-6" />
        <div className="text-sm text-gray-500">
          <ul className="space-y-1">
            <li>상호명: 이지티켓</li>
            <li>사업자등록번호: 601-15-58686</li>
            <li>대표자명: 김진성</li>
            <li>사업장 주소지: 경상남도 김해시 월산로 82-55</li>
            <li>전화번호: 055-311-0278</li>
          </ul>
        </div>
      </div>
    </footer>
  )
} 