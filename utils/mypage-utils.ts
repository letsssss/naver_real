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
  
  return statusMap[status?.toUpperCase()] || '판매중';
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
  console.log('현재 localStorage 키 목록:', Object.keys(localStorage));

  // 1. 일반적인 토큰 키들 확인
  const commonTokenKeys = ['token', 'access_token', 'supabase_token', 'auth-token'];
  for (const key of commonTokenKeys) {
    const tokenValue = localStorage.getItem(key);
    if (tokenValue && tokenValue.startsWith('eyJ')) {
      authToken = tokenValue;
      console.log(`✅ ${key}에서 JWT 토큰 발견`);
      break;
    }
  }

  // 2. Supabase localStorage 토큰 우선 탐색
  if (!authToken) {
    const supabaseKey = Object.keys(localStorage).find(key =>
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );

    if (supabaseKey) {
      try {
        const supabaseData = localStorage.getItem(supabaseKey);
        if (supabaseData) {
          try {
            // 먼저 JSON으로 파싱 시도
            const parsed = JSON.parse(supabaseData);
            if (parsed.access_token) {
              authToken = parsed.access_token;
              console.log("✅ Supabase localStorage에서 JSON 파싱으로 토큰 발견");
            }
          } catch (jsonError) {
            // 만약 JSON이 아니면 직접 토큰으로 사용
            if (supabaseData.startsWith('eyJ')) {
              authToken = supabaseData;
              console.log("✅ Supabase localStorage에서 JWT 토큰 직접 발견");
            } else {
              console.error("❌ Supabase localStorage 파싱 실패:", jsonError);
            }
          }
        }
      } catch (e) {
        console.error("❌ Supabase localStorage 접근 실패:", e);
      }
    }
  }

  // 3. auth-token 키 확인
  if (!authToken) {
    const authTokenKey = Object.keys(localStorage).find(key => key.includes('auth-token'));
    
    if (authTokenKey) {
      const tokenValue = localStorage.getItem(authTokenKey);
      
      if (tokenValue) {
        // JWT 토큰 형식인지 확인 (eyJ로 시작하면 JWT)
        if (tokenValue.startsWith('eyJ')) {
          authToken = tokenValue;
          console.log("✅ auth-token 키에서 JWT 토큰 직접 발견");
        } else {
          // JSON 파싱 시도
          try {
            const parsed = JSON.parse(tokenValue);
            if (parsed.access_token) {
              authToken = parsed.access_token;
              console.log("✅ auth-token 키에서 JSON 파싱으로 토큰 발견");
            }
          } catch (e) {
            console.error("❌ auth-token 키 값 파싱 실패:", e);
          }
        }
      }
    }
  }

  // 4. fallback: document.cookie에서 access_token 확인
  if (!authToken && typeof document !== 'undefined') {
    const match = document.cookie.match(/access_token=([^;]+)/);
    if (match && match[1]) {
      authToken = decodeURIComponent(match[1]);
      console.log("🍪 쿠키에서 access_token 발견");
    } else {
      console.warn("❌ 쿠키에서 access_token 없음");
    }
  }

  // 5. Supabase 쿠키 확인
  if (!authToken && typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name && name.includes('sb-') && name.includes('auth-token') && value) {
        try {
          const decodedValue = decodeURIComponent(value);
          if (decodedValue.startsWith('eyJ')) {
            authToken = decodedValue;
            console.log(`🍪 Supabase 쿠키 ${name}에서 토큰 발견`);
            break;
          }
        } catch (e) {
          console.error(`❌ 쿠키 ${name} 디코딩 실패:`, e);
        }
      }
    }
  }

  if (!authToken) {
    console.warn("❌ 최종적으로 토큰을 찾을 수 없음");
    console.log("현재 localStorage 전체 내용:");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`  ${key}: ${value?.substring(0, 50)}...`);
      }
    }
  } else {
    console.log("✅ 최종 토큰 발견:", authToken.substring(0, 20) + "...");
  }

  return authToken;
}; 