import Link from "next/link"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

// 임시 데이터 (실제로는 API나 데이터베이스에서 가져와야 합니다)
const confirmedPurchases = [
  {
    id: 5,
    title: "아이유 콘서트",
    date: "2024-01-20",
    venue: "올림픽공원 KSPO DOME",
    price: "165,000원",
    status: "거래완료",
    seller: "iu_fan1",
    completedAt: "2023-12-25 14:30",
    ticketInfo: {
      section: "1층 A구역",
      row: "10",
      seat: "15",
      entryTime: "오후 6:00",
    },
    reviewSubmitted: true,
  },
  {
    id: 6,
    title: "스트레이 키즈 팬미팅",
    date: "2024-02-05",
    venue: "고척스카이돔",
    price: "143,000원",
    status: "거래완료",
    seller: "stay_forever",
    completedAt: "2024-01-10 09:45",
    ticketInfo: {
      section: "2층 B구역",
      row: "5",
      seat: "22",
      entryTime: "오후 5:30",
    },
    reviewSubmitted: false,
  },
]

export default function ConfirmedPurchasesPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/mypage" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>마이페이지로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">거래완료된 구매</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center text-[#02C39A] mb-4">
            <CheckCircle2 className="mr-2" />
            <h2 className="text-lg font-semibold">거래완료된 구매 내역</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            구매확정이 완료된 거래입니다. 공연을 즐기고 판매자에게 리뷰를 남겨주세요.
          </p>

          {confirmedPurchases.length > 0 ? (
            <div className="space-y-6">
              {confirmedPurchases.map((purchase) => (
                <div key={purchase.id} className="border rounded-lg p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg">{purchase.title}</h3>
                      <p className="text-sm text-gray-600">
                        {purchase.date} | {purchase.venue}
                      </p>
                      <p className="text-sm font-semibold mt-2">{purchase.price}</p>
                      <p className="text-sm text-[#02C39A] mt-1">
                        <span className="inline-flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {purchase.status}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">판매자: {purchase.seller}</p>
                      <p className="text-xs text-gray-500 mt-1">거래완료: {purchase.completedAt}</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-4"></div>

                  <div className="mt-4 flex justify-end">
                    {!purchase.reviewSubmitted ? (
                      <Link
                        href={`/review/${purchase.id}`}
                        className="text-sm px-4 py-2 bg-[#02C39A] text-white rounded-md hover:bg-[#01A88A] transition-colors"
                      >
                        리뷰 작성하기
                      </Link>
                    ) : (
                      <span className="text-sm px-4 py-2 bg-gray-100 text-gray-500 rounded-md">리뷰 작성 완료</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">거래완료된 구매 내역이 없습니다.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
} 