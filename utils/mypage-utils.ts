import { getApiBaseUrl } from '@/lib/domain-config';

// API 기본 URL 설정 (환경별로 다른 호스트 사용)
export const API_BASE_URL = getApiBaseUrl();

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
  if (!status) return '판매중';
  
  const normalizedStatus = status.toUpperCase();
  
  const statusMap: Record<string, string> = {
    'PENDING': '취켓팅진행중',
    'PENDING_PAYMENT': '취켓팅진행중',
    'PROCESSING': '취켓팅진행중',
    'PROCESS': '취켓팅진행중',
    'COMPLETED': '취켓팅완료',
    'CONFIRMED': '거래완료',
    'CANCELLED': '거래취소',
    'ACTIVE': '판매중',
    'IN_PROGRESS': '취켓팅진행중'
  };
  
  // 상태값이 없거나 매핑되지 않은 상태인 경우 기본값 반환
  return statusMap[normalizedStatus] || '판매중';
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
  
  return colorMap[status?.toUpperCase()] || 'text-gray-600';
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
  
  return priorityMap[status?.toUpperCase()] || 6;
};

// Supabase 토큰을 가져오는 함수
export const getAuthToken = (): string => {
  if (typeof window === 'undefined') return '';

  let authToken = '';

  console.log('🔍 토큰 검색 시작...');

  // 1. Supabase localStorage 토큰 확인 (sb-xxx-auth-token 형태)
  const supabaseKey = Object.keys(localStorage).find(key =>
    key.startsWith('sb-') && key.endsWith('-auth-token')
  );

  if (supabaseKey) {
    try {
      const supabaseData = localStorage.getItem(supabaseKey);
      console.log(`🔍 ${supabaseKey} 내용:`, supabaseData?.substring(0, 100) + '...');
      
      if (supabaseData) {
        // JSON 객체인지 확인
        if (supabaseData.startsWith('{')) {
          const parsed = JSON.parse(supabaseData);
          if (parsed.access_token && parsed.access_token.startsWith('eyJ')) {
            authToken = parsed.access_token;
            // 토큰을 별도로 저장
            localStorage.setItem('supabase.auth.token', authToken);
            console.log(`✅ ${supabaseKey}에서 access_token 발견`);
            return authToken;
          }
        } else if (supabaseData.startsWith('eyJ')) {
          // 직접 토큰이 저장된 경우
          authToken = supabaseData;
          // 토큰을 별도로 저장
          localStorage.setItem('supabase.auth.token', authToken);
          console.log(`✅ ${supabaseKey}에서 직접 토큰 발견`);
          return authToken;
        }
      }
    } catch (e) {
      console.error(`❌ ${supabaseKey} 파싱 실패:`, e);
    }
  }

  // 2. 이미 저장된 토큰 확인
  const savedToken = localStorage.getItem('supabase.auth.token');
  if (savedToken && savedToken.startsWith('eyJ')) {
    console.log('✅ 저장된 토큰 발견');
    return savedToken;
  }

  // 3. 쿠키에서 토큰 확인
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name && (name.includes('token') || name.includes('auth')) && value) {
        try {
          const decodedValue = decodeURIComponent(value);
          if (decodedValue.startsWith('eyJ')) {
            authToken = decodedValue;
            // 토큰을 localStorage에도 저장
            localStorage.setItem('supabase.auth.token', authToken);
            console.log(`🍪 쿠키 ${name}에서 토큰 발견`);
            return authToken;
          }
        } catch (e) {
          console.error(`❌ 쿠키 ${name} 디코딩 실패:`, e);
        }
      }
    }
  }

  console.warn('❌ 유효한 토큰을 찾을 수 없습니다.');
  return '';
}; 