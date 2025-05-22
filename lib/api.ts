/**
 * 주문번호로 거래 정보를 조회하는 함수
 * @param orderNumber 주문번호
 * @returns 거래 정보
 */
export async function getTransactionByOrderNumber(orderNumber: string) {
  try {
    const response = await fetch(`/api/purchase/${orderNumber}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('거래 정보를 불러오는데 실패했습니다.');
    }

    return await response.json();
  } catch (error) {
    console.error('거래 정보 조회 오류:', error);
    return null;
  }
}

/**
 * 카카오 로그인을 시작합니다.
 * 
 * @param next 로그인 후 리다이렉트할 경로 (기본값: '/')
 * @returns 카카오 인증 URL이 포함된 응답
 */
export async function signInWithKakao(next = '/') {
  try {
    const response = await fetch(`/api/auth/kakao?next=${encodeURIComponent(next)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '카카오 로그인 요청 실패');
    }
    
    // 브라우저에서 카카오 인증 페이지로 리다이렉트
    window.location.href = data.url;
    return data;
  } catch (error) {
    console.error('카카오 로그인 오류:', error);
    throw error;
  }
}

/**
 * Supabase 로그아웃을 처리합니다.
 */
export async function signOut() {
  try {
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '로그아웃 요청 실패');
    }
    
    // 로그아웃 후 홈페이지로 리다이렉트
    window.location.href = '/';
    return data;
  } catch (error) {
    console.error('로그아웃 오류:', error);
    throw error;
  }
} 