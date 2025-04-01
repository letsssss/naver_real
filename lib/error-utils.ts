/**
 * 오류 로깅 및 처리 유틸리티
 */

/**
 * 상세한 오류 로깅 함수
 * 내부 문제 진단을 위해 오류 상황의 모든 관련 정보를 로깅합니다.
 * @param context - 오류가 발생한 컨텍스트 (예: "API 게시물 생성")
 * @param error - 발생한 오류 객체
 * @param request - 관련 요청 데이터 (선택 사항)
 */
export function logDetailedError(context: string, error: any, request?: any): void {
  console.error(`===== [${context}] 오류 세부 정보 =====`);
  console.error('시간:', new Date().toISOString());
  console.error('오류 유형:', error instanceof Error ? error.constructor.name : typeof error);
  console.error('메시지:', error instanceof Error ? error.message : error);
  
  // Supabase 오류 세부 정보
  if (error && typeof error === 'object') {
    if ('code' in error) console.error('오류 코드:', error.code);
    if ('hint' in error) console.error('힌트:', error.hint);
    if ('details' in error) console.error('세부 정보:', error.details);
    
    // 데이터베이스 컬럼 관련 오류 감지
    if ('message' in error && typeof error.message === 'string') {
      const message = error.message;
      if (message.includes('column') && message.includes('does not exist')) {
        const columnMatch = message.match(/column ['"]([^'"]+)['"]/);
        if (columnMatch && columnMatch[1]) {
          console.error('문제 컬럼:', columnMatch[1]);
          console.error('권장 조치: 이 컬럼이 데이터베이스 스키마에 존재하는지 확인하세요.');
        }
      }
    }
  }
  
  // 스택 트레이스 출력 (있는 경우)
  if (error instanceof Error && error.stack) {
    console.error('스택 트레이스:');
    console.error(error.stack);
  }
  
  // 요청 데이터 출력 (제공된 경우)
  if (request) {
    console.error('관련 요청 데이터:');
    try {
      console.error(JSON.stringify(request, null, 2));
    } catch (e) {
      console.error('요청 데이터 직렬화 실패:', e);
      console.error('원본 요청 객체:', request);
    }
  }
  
  console.error('=====================================');
}

/**
 * Supabase 에러 코드에 따른 사용자 친화적 메시지 생성
 * @param error - Supabase 에러 객체
 * @returns 사용자에게 표시할 수 있는 메시지
 */
export function getUserFriendlyErrorMessage(error: any): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  // 기본 메시지
  let message = '요청을 처리하는 중 문제가 발생했습니다.';
  
  // 직접적인 오류 메시지가 있는 경우
  if (typeof error === 'string') return error;
  
  // 오류 객체인 경우 코드에 따른 처리
  if (typeof error === 'object') {
    // 직접 메시지가 있는 경우
    if ('message' in error && typeof error.message === 'string') {
      // 기술적 오류 메시지를 사용자 친화적으로 변환
      const techMessage = error.message;
      
      if (techMessage.includes('duplicate key') || techMessage.includes('already exists')) {
        return '이미 존재하는 정보입니다.';
      }
      
      if (techMessage.includes('violates foreign key constraint')) {
        return '참조하는 데이터가 존재하지 않습니다.';
      }
      
      if (techMessage.includes('column') && techMessage.includes('does not exist')) {
        return '데이터 구조에 문제가 있습니다. 관리자에게 문의하세요.';
      }
      
      // 반환할 기본 메시지 설정
      message = error.message;
    }
    
    // 오류 코드에 따른 처리
    if ('code' in error) {
      const code = String(error.code);
      
      switch (code) {
        case '23505': // 중복 키 제약 조건 위반
          return '이미 동일한 정보가 등록되어 있습니다.';
        case '23503': // 외래 키 제약 조건 위반
          return '참조하는 데이터가 존재하지 않습니다.';
        case '42703': // 정의되지 않은 열
          return '데이터 구조가 일치하지 않습니다. 관리자에게 문의하세요.';
        case '22P02': // 잘못된 텍스트 표현
          return '입력한 데이터 형식이 올바르지 않습니다.';
        case '28P01': // 잘못된 비밀번호
          return '인증 정보가 올바르지 않습니다.';
        case '42P01': // 테이블이 존재하지 않음
          return '요청한 데이터 테이블이 존재하지 않습니다. 관리자에게 문의하세요.';
      }
    }
    
    // HTTP 상태 코드에 따른 처리
    if ('status' in error) {
      const status = Number(error.status);
      
      switch (status) {
        case 400:
          return '잘못된 요청입니다. 입력 내용을 확인해주세요.';
        case 401:
          return '로그인이 필요하거나 세션이 만료되었습니다.';
        case 403:
          return '이 작업을 수행할 권한이 없습니다.';
        case 404:
          return '요청한 정보를 찾을 수 없습니다.';
        case 409:
          return '요청이 현재 리소스 상태와 충돌합니다.';
        case 429:
          return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
        case 500:
          return '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
    }
  }
  
  // 기본 메시지 반환
  return message;
}

/**
 * 데이터베이스 스키마 오류인지 확인
 * @param error - 검사할 오류 객체
 * @returns 스키마 관련 오류인 경우 true
 */
export function isSchemaError(error: any): boolean {
  if (!error) return false;
  
  // 오류 객체에서 메시지 추출
  const message = error instanceof Error ? error.message : 
                 (typeof error === 'object' && 'message' in error) ? String(error.message) : 
                 (typeof error === 'string') ? error : '';
  
  // 스키마 관련 키워드 확인
  return message.includes('column') && 
         (message.includes('does not exist') || 
          message.includes('violates') || 
          message.includes('type'));
}

/**
 * 컬럼 이름 매핑 유틸리티
 * 클라이언트 코드에서 사용하는 이름을 Supabase 스키마 이름으로 변환
 * @param clientField - 클라이언트 코드에서 사용하는 필드 이름
 * @returns Supabase 데이터베이스의 컬럼 이름
 */
export function mapFieldToColumn(clientField: string): string {
  const fieldMap: Record<string, string> = {
    // 사용자 ID 관련
    'userId': 'author_id',
    'authorId': 'author_id',
    
    // 날짜 관련
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'publishedAt': 'published_at',
    
    // 게시물 관련
    'isPublished': 'is_published',
    'isDeleted': 'is_deleted',
    'viewCount': 'view_count',
    
    // 티켓 판매 관련
    'eventName': 'event_name', 
    'eventDate': 'event_date',
    'eventVenue': 'event_venue',
    'ticketPrice': 'ticket_price',
    'contactInfo': 'contact_info'
  };
  
  return fieldMap[clientField] || clientField; // 매핑 없으면 원래 이름 반환
} 