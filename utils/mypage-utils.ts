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
  const statusMap: Record<string, string> = {
    'PENDING': '취켓팅진행중',
    'PENDING_PAYMENT': '취켓팅진행중',
    'PROCESSING': '취켓팅진행중',
    'PROCESS': '취켓팅진행중',
    'COMPLETED': '취켓팅완료',
    'CONFIRMED': '거래완료',
    'CANCELLED': '거래취소',
    'ACTIVE': '판매중'
  };
  
  return statusMap[status] || '판매중';
};

// 상태별 색상 클래스 반환 함수
export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    'PENDING': 'text-blue-600',
    'PENDING_PAYMENT': 'text-blue-600',
    'PROCESSING': 'text-blue-600',
    'PROCESS': 'text-blue-600',
    'COMPLETED': 'text-green-600',
    'CONFIRMED': 'text-purple-600',
    'CANCELLED': 'text-red-600',
    'ACTIVE': 'text-gray-600'
  };
  
  return colorMap[status] || 'text-gray-600';
};

// 상태 우선순위 반환 함수
export const getStatusPriority = (status: string): number => {
  const priorityMap: Record<string, number> = {
    'PENDING': 1,
    'PENDING_PAYMENT': 1,
    'PROCESSING': 1,
    'PROCESS': 1,
    'COMPLETED': 2,
    'CONFIRMED': 3,
    'CANCELLED': 4,
    'ACTIVE': 5
  };
  
  return priorityMap[status] || 6;
};

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