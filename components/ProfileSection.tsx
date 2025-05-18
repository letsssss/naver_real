import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ProfileSectionProps {
  user: {
    name?: string;
    email?: string;
    createdAt?: string;
  } | null;
}

export default function ProfileSection({ user }: ProfileSectionProps) {
  // ISO 형식의 날짜 문자열을 한국 시간(KST)으로 포맷팅하는 함수
  const formatDate = (dateString?: string) => {
    if (!dateString) return "정보 없음";
    
    try {
      const date = new Date(dateString);
      
      // 날짜가 유효한지 확인
      if (isNaN(date.getTime())) {
        return "정보 없음";
      }
      
      // 한국 시간대로 변환하여 날짜 포맷팅
      return date.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).split(' ').slice(0, 3).join(' '); // '오전/오후 시간:분' 부분 제거, 날짜만 표시
    } catch (error) {
      console.error("날짜 변환 오류:", error);
      return "정보 없음";
    }
  };

  return (
    <div>
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <p className="text-blue-700 text-sm">이 정보는 회원님만 볼 수 있는 개인 정보입니다.</p>
      </div>
      <h2 className="text-xl font-semibold mb-4">프로필 정보</h2>
      <p>
        <strong>이름:</strong> {user?.name || "이름 정보 없음"}
      </p>
      <p>
        <strong>이메일:</strong> {user?.email || "이메일 정보 없음"}
      </p>
      <p>
        <strong>가입일:</strong> {formatDate(user?.createdAt)}
      </p>
      <Link href="/mypage/edit-profile">
        <Button className="mt-4 bg-[#FFD600] hover:bg-[#FFE600] text-black px-6 py-2">프로필 수정</Button>
      </Link>
    </div>
  );
} 