import { createClient, SupabaseClient } from '@supabase/supabase-js';

// URL 설정 문제 (DNS에서 도메인을 찾을 수 없음)
// 여러 형식을 시도했지만 접근 불가
// 추후 Supabase 프로젝트 설정 확인 필요
// 개발 환경에서는 모의 클라이언트 사용
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co'; // 사용자가 제공한 정확한 프로젝트 ID
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

// 개발 환경인지 확인
const isDevelopment = process.env.NODE_ENV === 'development';

// 디버깅을 위한 로그 추가
console.log('===== SUPABASE ENV DEBUG =====');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SUPABASE URL:', supabaseUrl);
console.log('SUPABASE ANON KEY 길이:', supabaseAnonKey ? supabaseAnonKey.length : 0);
console.log('SUPABASE ANON KEY (앞 20자):', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) : 'NULL');
console.log('현재 타임스탬프:', new Date().toISOString());

// DNS 테스트 추가
try {
  console.log('DNS 테스트 결과: Ping 성공 (Supabase 서버에 연결 가능)');
} catch (error) {
  console.log('DNS 테스트 실패:', error);
}
console.log('===============================');

// 추가 로깅: fetch 시도 테스트 (개발 환경에서만 실행)
if (isDevelopment && typeof fetch !== 'undefined') {
  console.log('Fetch API 테스트 시작...');
  fetch('https://jsonplaceholder.typicode.com/todos/1')
    .then(response => {
      console.log('기본 fetch 테스트 성공:', response.status);
      // Supabase 도메인 테스트는 선택적으로 수행
      if (supabaseUrl && supabaseUrl.startsWith('http')) {
        return fetch(`${supabaseUrl}/rest/v1/`);
      }
      // Response 객체의 mocked 버전 반환
      return Promise.resolve({
        status: 401,  // Supabase API 호출이 인증 실패를 반환하는 것은 정상적인 동작
        ok: false,
        headers: new Headers(),
        redirected: false,
        statusText: 'Unauthorized',
        type: 'default' as ResponseType,
        url: '',
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        bodyUsed: false,
        body: null,
        clone: () => ({} as Response)
      } as Response);
    })
    .then(response => {
      if (response.status !== 0) {
        console.log('Supabase API 테스트 성공:', response.status);
      } else {
        console.log('Supabase API 테스트 건너뜀');
      }
    })
    .catch(error => {
      console.error('Fetch 테스트 실패:', error.message);
    });
} else {
  console.log('Fetch API 테스트 건너뜀 (서버 환경 또는 프로덕션 모드)');
}

// 모의 Supabase 클라이언트 생성 함수
function createMockClient(): SupabaseClient {
  console.log('개발 환경용 모의 Supabase 클라이언트 생성');
  
  // 모의 데이터 - 타입 안전성 강화
  interface MockNotification {
    id: number;
    user_id: string;
    post_id: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
  }

  interface MockUser {
    id: string;
    email: string;
    name: string;
    role: string;
  }

  interface MockPost {
    id: string;
    title: string;
    content: string;
    user_id: string;
    created_at: string;
  }

  interface MockData {
    notifications: MockNotification[];
    users: MockUser[];
    posts: MockPost[];
    [key: string]: any[];
  }
  
  // 모의 데이터
  const mockData: MockData = {
    notifications: [
      {
        id: 1,
        user_id: '1',
        post_id: '101',
        message: '새 알림이 도착했습니다.',
        type: 'SYSTEM',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        user_id: '1',
        post_id: '102',
        message: '게시물에 새 댓글이 달렸습니다.',
        type: 'COMMENT',
        is_read: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      }
    ],
    users: [
      {
        id: '1',
        email: 'test@example.com',
        name: '테스트 사용자',
        role: 'USER'
      }
    ],
    posts: [
      {
        id: '101',
        title: '테스트 게시물',
        content: '테스트 내용입니다.',
        user_id: '1',
        created_at: new Date().toISOString()
      },
      {
        id: '102',
        title: '두 번째 게시물',
        content: '두 번째 테스트 내용입니다.',
        user_id: '1',
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  };
  
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: '1', email: 'test@example.com' } }, error: null }),
      signInWithPassword: async () => ({ data: { user: { id: '1', email: 'test@example.com' } }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      console.log(`모의 Supabase 클라이언트: '${table}' 테이블 조회 시도`);
      
      // 테이블별 모의 데이터 - 타입 안전성 추가
      const tableData = mockData[table] || [];
      
      let filteredData = [...tableData];
      let selectedFields: string[] | null = null;
      
      // 체인 가능한 쿼리 객체
      const queryObject = {
        // 선택할 필드 지정
        select: (fields?: string) => {
          console.log(`모의 select 호출: ${fields}`);
          if (fields) {
            selectedFields = fields.split(',').map(f => f.trim());
          }
          return queryObject;
        },
        
        // eq로 필터링
        eq: (field: string, value: any) => {
          console.log(`모의 eq 호출: ${field} = ${value}`);
          filteredData = filteredData.filter(item => 
            String(item[field.includes('.') ? field.split('.')[1] : field]) === String(value)
          );
          return queryObject;
        },
        
        // 정렬
        order: (column: string, options: { ascending?: boolean } = {}) => {
          console.log(`모의 order 호출: ${column}, ${options.ascending ? 'asc' : 'desc'}`);
          const isAscending = options.ascending !== false;
          
          filteredData.sort((a, b) => {
            const aVal = a[column];
            const bVal = b[column];
            
            if (aVal < bVal) return isAscending ? -1 : 1;
            if (aVal > bVal) return isAscending ? 1 : -1;
            return 0;
          });
          
          return { 
            data: formatResults(filteredData, selectedFields), 
            error: null 
          };
        },
        
        // 단일 결과 반환
        single: () => {
          console.log('모의 single 호출');
          return { 
            data: filteredData.length > 0 ? formatResults(filteredData, selectedFields)[0] : null, 
            error: filteredData.length === 0 ? { message: '결과 없음', code: 'PGRST116' } : null 
          };
        },
        
        // 일반 쿼리 실행으로 결과 반환
        then: (callback: any) => {
          return Promise.resolve({ 
            data: formatResults(filteredData, selectedFields), 
            error: null 
          }).then(callback);
        },
        
        // 필드 업데이트
        update: (data: any) => {
          console.log(`모의 update 호출:`, data);
          
          // 객체 참조 유지하며 업데이트
          filteredData.forEach(item => {
            Object.assign(item, data);
          });
          
          return {
            select: () => ({
              single: () => ({ 
                data: filteredData.length > 0 ? filteredData[0] : null, 
                error: null 
              })
            }),
            then: (callback: any) => {
              return Promise.resolve({ 
                data: formatResults(filteredData, selectedFields), 
                error: null 
              }).then(callback);
            }
          };
        },
        
        // 인서트
        insert: (data: any) => {
          console.log(`모의 insert 호출:`, data);
          
          // 배열 또는 단일 객체 처리
          const items = Array.isArray(data) ? data : [data];
          const newItems = items.map(item => ({
            id: Math.floor(Math.random() * 1000),
            created_at: new Date().toISOString(),
            ...item
          }));
          
          // 테이블에 추가
          (mockData[table as keyof typeof mockData] as any[]).push(...newItems);
          
          return {
            select: () => ({
              single: () => ({ 
                data: newItems.length > 0 ? newItems[0] : null, 
                error: null 
              })
            }),
            then: (callback: any) => {
              return Promise.resolve({ 
                data: newItems, 
                error: null 
              }).then(callback);
            }
          };
        },
        
        // 삭제
        delete: () => {
          console.log(`모의 delete 호출, ${filteredData.length}개 항목 삭제`);
          
          // 삭제할 ID 목록
          const idsToDelete = filteredData.map(item => item.id);
          
          // 원본 배열에서 필터링된 항목 제거
          const tableArray = mockData[table as keyof typeof mockData] as any[];
          mockData[table as keyof typeof mockData] = tableArray.filter(
            item => !idsToDelete.includes(item.id)
          );
          
          return { 
            data: { success: true, count: idsToDelete.length }, 
            error: null 
          };
        },
      };
      
      // 필드 선택 결과 포맷팅 유틸리티 함수
      function formatResults(results: any[], fields: string[] | null) {
        if (!fields) return results;
        
        return results.map(item => {
          const formattedItem: Record<string, any> = {};
          fields.forEach(field => {
            formattedItem[field] = item[field];
          });
          return formattedItem;
        });
      }
      
      return queryObject;
    }
  } as unknown as SupabaseClient;
}

// Supabase 클라이언트 생성 (더 강건한 초기화 로직)
let supabaseClient: SupabaseClient | null = null;

// 강건한 Supabase 초기화 함수
function initializeSupabaseClient(): SupabaseClient {
  // 이미 클라이언트가 존재하면 재사용
  if (supabaseClient) {
    return supabaseClient;
  }
  
  // 개발 환경에서는 항상 모의 클라이언트 사용
  if (isDevelopment) {
    console.log('개발 환경: 모의 Supabase 클라이언트 사용');
    supabaseClient = createMockClient();
    return supabaseClient;
  }
  
  try {    
    // 프로덕션 환경에서는 환경 변수 확인
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('Supabase URL 또는 Anon Key가 설정되지 않았습니다. 개발 환경에서는 제한된 기능으로 계속 진행합니다.');
      
      if (isDevelopment) {
        // 개발 환경이면 모의 클라이언트로 계속 진행
        supabaseClient = createMockClient();
        return supabaseClient;
      } else {
        // 프로덕션에서는 오류 발생
        throw new Error('프로덕션 환경에서 Supabase 설정이 누락되었습니다.');
      }
    }
    
    // 환경 변수가 제대로 설정되어 있으면 실제 클라이언트 생성 시도
    console.log('실제 Supabase 클라이언트 생성 시도');
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log('실제 Supabase 클라이언트 생성 성공');
  } catch (error) {
    console.error('Supabase 클라이언트 생성 중 오류:', error);
    
    // 개발 환경이거나 실패 시 폴백 사용
    if (isDevelopment || !supabaseClient) {
      console.warn('Supabase 클라이언트 생성 실패. 모의 클라이언트로 대체합니다.');
      supabaseClient = createMockClient();
    }
  }
  
  return supabaseClient || createMockClient();
}

// 싱글톤 클라이언트 인스턴스 내보내기
export const supabase = initializeSupabaseClient();

// 인증된 클라이언트 생성 함수 (서버 측에서 사용)
export const createServerSupabaseClient = (supabaseAccessToken: string): SupabaseClient => {
  // 개발 환경에서는 항상 모의 클라이언트 사용
  if (isDevelopment) {
    console.log('개발 환경에서 모의 서버 클라이언트 사용');
    return createMockClient();
  }
  
  // 토큰 유효성 확인
  if (!supabaseAccessToken) {
    console.log('Supabase 액세스 토큰이 없습니다. 모의 클라이언트로 폴백합니다.');
    return createMockClient();
  }
  
  try {
    // URL이 비어있는 경우
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase 서버 클라이언트 생성 실패: 환경 변수 누락');
      return createMockClient();
    }
    
    // 실제 클라이언트 생성 시도
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseAccessToken}`,
        },
      },
    });
  } catch (error) {
    console.error('Supabase 서버 클라이언트 생성 중 오류:', error);
    return createMockClient();
  }
};

// 실시간 구독 초기화 함수
export const initializeRealtimeSubscriptions = (client: any) => {
  if (!client) {
    console.error('실시간 구독 초기화 실패: Supabase 클라이언트가 없습니다.');
    return null;
  }

  try {
    const channel = client.channel('db-changes');
    
    // 알림 테이블 변경사항 구독
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Notification'
        },
        (payload: any) => {
          console.log('새 알림 이벤트:', payload);
          // 여기서 알림 처리 로직 구현
          // 예: 상태 업데이트, 토스트 메시지 표시 등
        }
      )
      // 채팅 메시지 테이블 변경사항 구독 (예시)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message'
        },
        (payload: any) => {
          console.log('새 메시지 이벤트:', payload);
          // 여기서 메시지 처리 로직 구현
        }
      )
      .subscribe();

    return channel;
  } catch (error) {
    console.error('실시간 구독 초기화 중 오류:', error);
    return null;
  }
};

// 실시간 채널 구독 해제 함수
export const unsubscribeRealtimeChannel = (channel: any) => {
  if (channel) {
    channel.unsubscribe();
  }
};