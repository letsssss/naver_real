// API 기본 URL 설정 (환경별로 다른 호스트 사용)
export const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

// 날짜 형식화 함수
export const formatDate = (...dates: (string | undefined)[]): string => {
  // 유효한 날짜 찾기
  for (const date of dates) {
    if (!date) continue;
    
    try {
      const parsedDate = new Date(date);
      // 날짜가 유효한지 확인
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString();
      }
    } catch (e) {
      console.error("날짜 변환 오류:", e);
    }
  }
  
  // 유효한 날짜가 없는 경우 기본값 반환
  return "날짜 정보 없음";
};

// 상태 텍스트 변환 함수
export const getStatusText = (status: string) => {
  switch (status) {
    case 'PENDING': return '입금 대기중';
    case 'PROCESSING': return '처리 중';
    case 'COMPLETED': return '완료됨';
    case 'CONFIRMED': return '구매 확정됨';
    case 'CANCELLED': return '취소됨';
    default: return '상태 불명';
  }
};

// Supabase 토큰을 가져오는 함수
export const getAuthToken = (): string => {
  if (typeof window === 'undefined') return '';
  
  let authToken = '';
  
  // 1. Supabase 저장소 키 가져오기
  const supabaseKey = Object.keys(localStorage).find(key => 
    key.startsWith('sb-') && key.endsWith('-auth-token')
  );
  
  if (supabaseKey) {
    try {
      const supabaseData = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
      if (supabaseData.access_token) {
        authToken = supabaseData.access_token;
        console.log("✅ Supabase 저장소에서 토큰 발견");
      }
    } catch (e) {
      console.error("❌ Supabase 저장소 파싱 실패:", e);
    }
  }
  
  // 토큰이 없으면 다른 저장소 확인
  if (!authToken) {
    authToken = localStorage.getItem('token') || 
                localStorage.getItem('access_token') || 
                localStorage.getItem('supabase_token') || '';
    
    if (authToken) {
      console.log("✅ 기존 저장소에서 토큰 발견");
    }
  }
  
  return authToken;
}; 