import { Loader as LoaderIcon } from "lucide-react";

// 로딩 컴포넌트 props 타입 정의
interface LoaderProps {
  size?: number;
}

// 간단한 인라인 Loader 컴포넌트
export const Loader = ({ size = 24 }: LoaderProps) => (
  <div className="animate-spin" style={{ width: size, height: size }}>
    <LoaderIcon size={size} />
  </div>
); 