import { getSupabaseClient } from '@/lib/supabase';

/**
 * 인증 토큰을 포함한 API 호출을 처리하는 유틸리티 함수
 * 401 오류 발생 시 토큰 갱신을 자동으로 시도합니다
 * 
 * @param url API 엔드포인트 URL
 * @param options fetch 옵션
 * @returns fetch 응답
 */
export async function callAPI(url: string, options: RequestInit = {}) {
  try {
    // 1. 세션에서 토큰 가져오기
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    // 2. 토큰이 없으면 오류 발생
    if (!token) {
      console.error('❌ 인증 토큰이 없습니다. 로그인이 필요합니다.');
      throw new Error('로그인이 필요합니다');
    }
    
    // 3. 토큰을 포함하여 API 요청
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include' // 쿠키 포함
    });
    
    // 4. 401 오류 처리 (토큰 만료)
    if (response.status === 401) {
      console.log('🔄 인증 토큰이 만료되었습니다. 토큰 갱신 시도...');
      
      // 토큰 갱신 시도
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        console.error('❌ 토큰 갱신 실패:', error);
        
        // 브라우저 환경인 경우 로그인 페이지로 리디렉션
        if (typeof window !== 'undefined') {
          const currentPath = encodeURIComponent(window.location.pathname);
          window.location.href = `/login?redirect=${currentPath}`;
        }
        
        throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
      }
      
      // 새 토큰으로 API 요청 재시도
      console.log('✅ 토큰 갱신 성공, 요청 재시도');
      return callAPI(url, options);
    }
    
    // 5. 응답 반환
    return response;
    
  } catch (error) {
    console.error('API 호출 오류:', error);
    throw error;
  }
}

/**
 * GET 요청 편의 함수
 */
export async function fetchData(url: string, options: RequestInit = {}) {
  return callAPI(url, {
    method: 'GET',
    ...options
  });
}

/**
 * POST 요청 편의 함수
 */
export async function postData(url: string, data: any, options: RequestInit = {}) {
  return callAPI(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options
  });
}

/**
 * PUT 요청 편의 함수
 */
export async function putData(url: string, data: any, options: RequestInit = {}) {
  return callAPI(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options
  });
}

/**
 * DELETE 요청 편의 함수
 */
export async function deleteData(url: string, options: RequestInit = {}) {
  return callAPI(url, {
    method: 'DELETE',
    ...options
  });
}

export const api = {
  async get(url: string) {
    const supabase = await getSupabaseClient();
    // API 구현
  },
  
  async post(url: string, data: any) {
    const supabase = await getSupabaseClient();
    // API 구현
  }
}; 