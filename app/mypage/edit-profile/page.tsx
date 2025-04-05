"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

export default function EditProfilePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
  })

  useEffect(() => {
    console.log("✅ useEffect 진입")
    if (!user) {
      toast.error("로그인이 필요한 페이지입니다")
      router.push("/login?callbackUrl=/mypage/edit-profile")
      return
    }

    const fetchUserData = async () => {
      console.log("🔥 fetchUserData() 실행됨")  // 디버깅 로그
      setIsLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/user/update-profile`, {
          method: "GET",
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache",
          },
        })

        console.log("프로필 정보 요청 응답 상태:", response.status)

        if (!response.ok) {
          if (response.status === 401) {
            toast.error("세션이 만료되었습니다. 다시 로그인해 주세요.")
            router.push("/login?callbackUrl=/mypage/edit-profile")
            return
          }
          throw new Error("사용자 정보를 가져오지 못했습니다.")
        }

        const data = await response.json()
        if (data.success) {
          setUserData({
            name: data.user.name || "",
            email: data.user.email || "",
            phoneNumber: data.user.phoneNumber || "",
            bankName: data.user.bankInfo?.bankName || "",
            accountNumber: data.user.bankInfo?.accountNumber || "",
            accountHolder: data.user.bankInfo?.accountHolder || "",
          })
        } else {
          toast.error(data.message || "사용자 정보를 가져오지 못했습니다.")
        }
      } catch (error) {
        console.error("🔥 사용자 정보 가져오기 실패:", error)
        toast.error("사용자 정보를 불러오는 중 오류가 발생했습니다.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [user, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setUserData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/update-profile`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: userData.name,
          phoneNumber: userData.phoneNumber,
          bankName: userData.bankName,
          accountNumber: userData.accountNumber,
          accountHolder: userData.accountHolder,
        }),
      })

      console.log("프로필 수정 응답 상태:", response.status)

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("세션이 만료되었습니다. 다시 로그인해 주세요.")
          router.push("/login?callbackUrl=/mypage/edit-profile")
          return
        }
        throw new Error("프로필 수정 실패")
      }

      const result = await response.json()
      if (result.success) {
        toast.success("프로필이 성공적으로 수정되었습니다.")
        router.push("/mypage")
      } else {
        toast.error(result.message || "수정에 실패했습니다.")
      }
    } catch (err) {
      console.error("🔥 프로필 수정 오류:", err)
      toast.error("프로필 수정 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>사용자 정보를 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/mypage" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>마이페이지로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">프로필 수정</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                이름
              </label>
              <Input id="name" name="name" type="text" value={userData.name} onChange={handleChange} required />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일 (변경 불가)
              </label>
              <Input id="email" name="email" type="email" value={userData.email} disabled className="bg-gray-100" />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                휴대폰번호
              </label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={userData.phoneNumber}
                onChange={handleChange}
                placeholder="'-' 없이 입력해주세요"
              />
            </div>

            <div className="pt-4 border-t mt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">계좌 정보</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-1">
                    은행명
                  </label>
                  <Input
                    id="bankName"
                    name="bankName"
                    type="text"
                    value={userData.bankName}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    계좌번호
                  </label>
                  <Input
                    id="accountNumber"
                    name="accountNumber"
                    type="text"
                    value={userData.accountNumber}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700 mb-1">
                    예금주명
                  </label>
                  <Input
                    id="accountHolder"
                    name="accountHolder"
                    type="text"
                    value={userData.accountHolder}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0061FF] hover:bg-[#0052D6] text-white"
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "변경사항 저장"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}

