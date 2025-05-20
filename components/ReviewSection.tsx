// 리뷰 데이터 타입 정의
interface Review {
  category: string
  title: string
  name: string
  date: string
  stars: number
  comment: string
}

// 더미 리뷰 데이터
const dummyReviews = [
  {
    category: "콘서트",
    title: "NCT 도영 단독콘서트",
    name: "이*라",
    date: "2025. 05. 20",
    stars: 5,
    comment:
      "이번 도영콘 후에 군대 간다는 말이 있어서 정말 간절한 콘서트였어요 🥹🥲 예매 실패하고 멘붕이었는데 이지티켓 통해서 3층이라도 입성해서 너무 감사했어요 ㅠㅠ 다음 티켓팅도 무조건 여기서 할게요 💕",
  },
  {
    category: "스포츠",
    title: "KBO - 한화 vs 롯데",
    name: "김*혁",
    date: "2025. 05. 18",
    stars: 5,
    comment:
      "야구장 직관 처음인데 덕분에 깔끔하게 예매 완료했어요. 판매자분도 응답 빨랐고 좌석도 설명해주셔서 좋았습니다. 무사히 입장하고 재밌게 보고 왔습니다!",
  },
  {
    category: "공연",
    title: "뮤지컬 <레베카>",
    name: "이*현",
    date: "2025. 05. 17",
    stars: 4,
    comment:
      "티켓팅 처음 해보는 거라 좀 걱정했는데 설명이 친절해서 수월했어요. 좌석도 괜찮았고 입장도 문제 없이 완료! 다음엔 좀 더 앞자리로 부탁드릴게요 😊",
  },
  {
    category: "콘서트",
    title: "제이홉 콘서트",
    name: "유*림",
    date: "2025. 05. 15",
    stars: 5,
    comment:
      "공연 당일에 갑자기 취켓팅 떠서 부탁드렸는데 진짜 몇 분 만에 잡아주셨어요… 이지티켓 아니었으면 못 갔을 듯 ㅠㅠ 감사합니다 정말루!!",
  },
]

export function ReviewSection() {
  // 별점 렌더링 함수
  const renderStars = (count: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span 
            key={i} 
            className={`text-2xl leading-none ${
              i < count ? "text-amber-500" : "text-gray-300"
            }`}
            style={{ 
              color: i < count ? '#f59e0b' : '#d1d5db',
              filter: i < count ? 'drop-shadow(0 0 0.5px rgba(0,0,0,0.1))' : 'none',
              transform: 'translateY(-1px)'
            }}
          >
            ★
          </span>
        ))}
      </div>
    )
  }

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">이지티켓 사용자 후기</h2>
          <p className="text-gray-600">실제 고객들의 생생한 이용 후기를 확인해보세요</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {dummyReviews.map((review, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-600">
                  {review.category}
                </span>
                {renderStars(review.stars)}
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-1">
                {review.title}
              </h3>
              
              <div className="flex items-center text-sm text-gray-500 mb-4">
                <span>{review.name}</span>
                <span className="mx-2">•</span>
                <span>{review.date}</span>
              </div>
              
              <p className="text-gray-700 text-sm">
                {review.comment}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 