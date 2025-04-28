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
    'PENDING': '취켓팅진행중',
    'PENDING_PAYMENT': '취켓팅진행중',
    'PROCESSING': '취켓팅진행중',
    'PROCESS': '취켓팅진행중',
    'COMPLETED': '취켓팅완료',
    'CONFIRMED': '거래완료',
    'CANCELLED': '거래취소',
    'ACTIVE': '판매중',
    '판매중': '판매중',
    '취켓팅 진행중': '취켓팅진행중',
    '취켓팅 완료': '취켓팅완료',
    '거래 완료': '거래완료',
    '거래 취소': '거래취소'
  };
  return statusMap[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colorMap: { [key: string]: string } = {
    'PENDING': 'text-blue-500',
    'PENDING_PAYMENT': 'text-blue-500',
    'PROCESSING': 'text-blue-500',
    'PROCESS': 'text-blue-500',
    'COMPLETED': 'text-green-500',
    'CONFIRMED': 'text-purple-500',
    'CANCELLED': 'text-red-500',
    'ACTIVE': 'text-gray-500',
    '판매중': 'text-gray-500',
    '취켓팅진행중': 'text-blue-500',
    '취켓팅완료': 'text-green-500',
    '거래완료': 'text-purple-500',
    '거래취소': 'text-red-500'
  };
  return colorMap[status] || 'text-gray-500';
};

export const getStatusPriority = (status: string): number => {
  const priorityMap: { [key: string]: number } = {
    'PENDING': 1,
    'PENDING_PAYMENT': 1,
    'PROCESSING': 1,
    'PROCESS': 1,
    'COMPLETED': 2,
    'CONFIRMED': 3,
    'CANCELLED': 4,
    'ACTIVE': 0,
    '판매중': 0,
    '취켓팅진행중': 1,
    '취켓팅완료': 2,
    '거래완료': 3,
    '거래취소': 4
  };
  return priorityMap[status] || 5;
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