"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"

// 서버로부터 받은 데이터 타입 정의
interface Post {
  id: number;
  title: string;
  content: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  ticketPrice: number | string;
  createdAt: string;
  authorId?: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

// 가격을 숫자로 변환하는 함수
const getPriceNumber = (price: string | number) => {
  if (typeof price === 'number') return price;
  return Number.parseInt(price.replace(/[^0-9]/g, ""), 10)
}

export default function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams?.get("query") || ""
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null)
  const [results, setResults] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchSearchResults = async () => {
      try {
        setLoading(true)
        setError("")
        
        let apiUrl = `/api/available-posts?search=${encodeURIComponent(query)}`
        
        console.log(`검색 API 호출 (구매 가능 게시물): ${apiUrl}`)
        
        apiUrl += `&t=${Date.now()}`
        
        const response = await fetch(apiUrl, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store',
          next: { revalidate: 0 }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        
        console.log("검색 API 응답:", data)
        
        if (data.success) {
          console.log("검색 결과:", data.posts)
          if (data.posts && data.posts.length > 0) {
            console.log("첫 번째 검색 결과 항목:", data.posts[0])
          }
          setResults(data.posts || [])
          console.log("검색 결과 로드 완료:", data.posts?.length || 0, "개 항목")
          
          if (data.posts?.length === 0) {
            console.log("검색 결과가 없습니다.")
          }
        } else {
          console.error("API 응답 오류:", data.error || "알 수 없는 오류")
          setError(data.error || "검색 결과를 불러오는데 실패했습니다.")
        }
      } catch (err) {
        console.error("검색 결과 불러오기 오류:", err)
        setError("검색 결과를 불러오는데 실패했습니다.")
      } finally {
        setLoading(false)
      }
    }

    fetchSearchResults()
  }, [query])

  const sortedResults = [...results].sort((a, b) => {
    if (sortOrder === "asc") {
      return getPriceNumber(a.ticketPrice || 0) - getPriceNumber(b.ticketPrice || 0)
    } else if (sortOrder === "desc") {
      return getPriceNumber(b.ticketPrice || 0) - getPriceNumber(a.ticketPrice || 0)
    }
    return 0
  })

  const handleRetry = () => {
    setResults([])
    setError("")
    
    const fetchSearchResults = async () => {
      try {
        setLoading(true)
        
        let apiUrl = `/api/available-posts?search=${encodeURIComponent(query)}`
        
        apiUrl += `&t=${Date.now()}`
        
        const response = await fetch(apiUrl, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store',
          next: { revalidate: 0 }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.success) {
          setResults(data.posts || [])
        } else {
          setError(data.error || "검색 결과를 불러오는데 실패했습니다.")
        }
      } catch (err) {
        console.error("재시도 중 오류:", err)
        setError("검색 결과를 불러오는데 실패했습니다.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchSearchResults()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-6">
            <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span>홈으로 돌아가기</span>
            </Link>
            <h1 className="text-3xl font-bold mt-4">검색 중...</h1>
            <p className="text-gray-600 mt-2">&quot;{query}&quot;에 대한 검색 결과를 불러오는 중입니다</p>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>홈으로 돌아가기</span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mt-4">검색 결과</h1>
              <p className="text-gray-600 mt-2">
                &quot;{query}&quot;에 대한 검색 결과
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
          <Button variant="outline" className="rounded-full whitespace-nowrap">
            최신순
          </Button>
          <Button variant="outline" className="rounded-full whitespace-nowrap">
            인기순
          </Button>
          <Button
            variant={sortOrder === "asc" ? "confirm" : "outline"}
            className="rounded-full whitespace-nowrap"
            onClick={() => setSortOrder("asc")}
          >
            낮은가격순
          </Button>
          <Button
            variant={sortOrder === "desc" ? "confirm" : "outline"}
            className="rounded-full whitespace-nowrap"
            onClick={() => setSortOrder("desc")}
          >
            높은가격순
          </Button>
        </div>

        {error ? (
          <div className="text-center py-12">
            <div className="flex flex-col items-center">
              <div className="text-red-500 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto mb-4"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-xl font-medium">{error}</p>
              </div>
              <p className="mt-2 text-gray-500 mb-4">검색 중 오류가 발생했습니다. 다시 시도해 주세요.</p>
              <Button
                variant="outline"
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600"
                onClick={handleRetry}
              >
                <RefreshCw className="h-4 w-4" />
                다시 시도하기
              </Button>
            </div>
          </div>
        ) : sortedResults.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedResults.map((item) => (
              <Link href={`/ticket-cancellation/${item.id}`} key={item.id}>
                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <Image
                    src={"/placeholder.svg"}
                    alt={item.title}
                    width={400}
                    height={200}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-gray-600 mb-2">{item.eventName}</p>
                    <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
                      <span>
                        {item.eventDate}
                      </span>
                      <span>{item.eventVenue}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <span>판매자:</span>
                      {item.author ? (
                        <span
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.href = `/seller/${item.author?.id}`;
                          }}
                          className="ml-1 text-blue-600 hover:underline flex items-center cursor-pointer"
                        >
                          {item.author.name}
                          <div className="flex items-center ml-2 text-yellow-500">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mr-1"
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            <span className="text-xs">4.5</span>
                          </div>
                        </span>
                      ) : (
                        <span className="ml-1 text-gray-500">정보 없음</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-black">{Number(item.ticketPrice || 0).toLocaleString()}원</span>
                      <span className="px-2 py-1 rounded text-sm bg-green-100 text-green-600">
                        판매중
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">검색 결과가 없습니다.</p>
            <p className="mt-2 text-gray-500">다른 검색어로 다시 시도해 보세요.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function getCategoryName(category: string): string {
  const categoryMap: Record<string, string> = {
    'concert': '콘서트',
    'musical': '뮤지컬/연극',
    'sports': '스포츠',
    'exhibition': '전시/행사'
  };
  
  return categoryMap[category] || category;
}

