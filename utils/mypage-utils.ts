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
export const getStatusText = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    'PENDING': '결제 대기',
    'PROCESSING': '처리 중',
    'CONFIRMED': '구매 확정',
    'COMPLETED': '완료',
    'CANCELLED': '취소됨',
    'REFUNDED': '환불됨',
    'FAILED': '실패',
    'EXPIRED': '만료됨',
    'TICKETING_STARTED': '취켓팅 시작',
    'TICKETING_COMPLETED': '취켓팅 완료',
    'TICKETING_FAILED': '취켓팅 실패',
    'TICKETING_EXPIRED': '취켓팅 만료',
    'TICKETING_CANCELLED': '취켓팅 취소',
    'TICKETING_REFUNDED': '취켓팅 환불',
    'TICKETING_PROCESSING': '취켓팅 처리 중',
    'TICKETING_PENDING': '취켓팅 대기',
    'TICKETING_CONFIRMED': '취켓팅 확정'
  }
  return statusMap[status] || status
}

export const getStatusColor = (status: string): string => {
  const colorMap: { [key: string]: string } = {
    'PENDING': 'text-yellow-600',
    'PROCESSING': 'text-blue-600',
    'CONFIRMED': 'text-green-600',
    'COMPLETED': 'text-green-600',
    'CANCELLED': 'text-red-600',
    'REFUNDED': 'text-gray-600',
    'FAILED': 'text-red-600',
    'EXPIRED': 'text-gray-600',
    'TICKETING_STARTED': 'text-blue-600',
    'TICKETING_COMPLETED': 'text-green-600',
    'TICKETING_FAILED': 'text-red-600',
    'TICKETING_EXPIRED': 'text-gray-600',
    'TICKETING_CANCELLED': 'text-red-600',
    'TICKETING_REFUNDED': 'text-gray-600',
    'TICKETING_PROCESSING': 'text-blue-600',
    'TICKETING_PENDING': 'text-yellow-600',
    'TICKETING_CONFIRMED': 'text-green-600'
  }
  return colorMap[status] || 'text-gray-600'
}

// Supabase 토큰을 가져오는 함수
export const getAuthToken = (): string => {
  if (typeof window === 'undefined') return '';

  let authToken = '';

  // 1. Supabase localStorage 토큰 우선 탐색
  const supabaseKey = Object.keys(localStorage).find(key =>
    key.startsWith('sb-') && key.endsWith('-auth-token')
  );

  if (supabaseKey) {
    try {
      const supabaseData = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
      if (supabaseData.access_token) {
        authToken = supabaseData.access_token;
        console.log("✅ Supabase localStorage에서 토큰 발견:", authToken);
      }
    } catch (e) {
      console.error("❌ Supabase localStorage 파싱 실패:", e);
    }
  }

  // 2. fallback: 일반 토큰 키 확인
  if (!authToken) {
    authToken = localStorage.getItem('token') ||
                localStorage.getItem('access_token') ||
                localStorage.getItem('supabase_token') ||
                '';
    if (authToken) {
      console.log("✅ 일반 localStorage 키에서 토큰 발견:", authToken);
    }
  }

  // 3. fallback: document.cookie에서 access_token 확인
  if (!authToken && typeof document !== 'undefined') {
    const match = document.cookie.match(/access_token=([^;]+)/);
    if (match && match[1]) {
      authToken = match[1];
      console.log("🍪 쿠키에서 access_token 발견:", authToken);
    } else {
      console.warn("❌ 쿠키에서 access_token 없음");
    }
  }

  if (!authToken) {
    console.warn("❌ 최종적으로 토큰을 찾을 수 없음");
  }

  return authToken;
}; 