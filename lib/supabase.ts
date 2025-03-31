import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 환경 변수 설정 확인
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 개발 환경인지 확인
const isDevelopment = process.env.NODE_ENV === 'development';

// 디버깅을 위한 로그 추가
console.log('===== SUPABASE ENV DEBUG =====');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SUPABASE URL:', supabaseUrl || '설정되지 않음');
console.log('SUPABASE ANON KEY 길이:', supabaseAnonKey ? supabaseAnonKey.length : 0);
console.log('현재 타임스탬프:', new Date().toISOString());
console.log('===============================');

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

// Supabase 클라이언트 생성
let supabaseClient: SupabaseClient;

try {
  // 개발 환경이면서 환경 변수가 설정되지 않은 경우 모의 클라이언트 사용
  if (isDevelopment && (!supabaseUrl || !supabaseAnonKey)) {
    console.log('개발 환경에서 환경 변수 누락: 모의 Supabase 클라이언트 사용');
    supabaseClient = createMockClient();
  } 
  // 프로덕션 환경에서 환경 변수가 누락된 경우 오류 발생
  else if (!isDevelopment && (!supabaseUrl || !supabaseAnonKey)) {
    throw new Error('프로덕션 환경에서 Supabase URL이나 Anon Key가 설정되지 않았습니다.');
  }
  // 환경 변수가 설정된 경우 실제 클라이언트 생성 시도
  else {
    console.log('실제 Supabase 클라이언트 생성 시도');
    supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!);
  }
} catch (error) {
  console.error('Supabase 클라이언트 생성 중 오류:', error);
  
  // 개발 환경에서만 모의 클라이언트로 폴백
  if (isDevelopment) {
    console.warn('Supabase 클라이언트 생성 실패, 개발 환경에서 모의 클라이언트로 대체합니다.');
    supabaseClient = createMockClient();
  } else {
    // 프로덕션 환경에서는 실제로 오류 발생
    throw error;
  }
}

// 싱글톤 클라이언트 인스턴스 내보내기
export const supabase = supabaseClient;

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