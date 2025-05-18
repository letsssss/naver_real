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
  const formatDate = (dateString?: string) => {
    if (!dateString) return "정보 없음";
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return "정보 없음";
      }
      
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
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