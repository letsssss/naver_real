import { NextResponse } from 'next/server';
import { supabase, createServerSupabaseClient } from '@/lib/supabase';
import { verifyToken, getTokenFromHeaders, getTokenFromCookies, isDevelopment } from '@/lib/auth';
import { cors } from '@/lib/cors';

// CORS 헤더 설정을 위한 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 캐시 방지 헤더
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

// OPTIONS 요청 처리
export async function OPTIONS(request: Request) {
  return new NextResponse(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// 알림 목록 조회
export async function GET(req: Request) {
  try {
    console.log('알림 API 호출됨');
    
    // JWT 토큰 확인
    const token = getTokenFromHeaders(req.headers) || getTokenFromCookies(req);
    console.log('토큰 정보:', token ? '토큰 있음' : '토큰 없음');
    
    // 개발 환경에서 토큰 검증 우회 옵션
    let userId = 0;
    
    if (token) {
      try {
        // Supabase 서버 클라이언트 생성 시도
        try {
          const supabaseServerClient = createServerSupabaseClient(token);
          const { data: { user }, error } = await supabaseServerClient.auth.getUser();
          
          if (error) {
            console.error('Supabase 토큰 검증 실패:', error.message);
            console.log('Supabase 토큰 검증 실패: Supabase 설정 누락');
          } else if (user) {
            console.log('Supabase 인증 성공, 사용자 ID:', user.id);
            // Supabase의 사용자 ID를 숫자로 변환 (필요한 경우)
            userId = parseInt(user.id, 10) || 3; // 기본값 3은 개발용
            return await getNotificationsForUser(userId, req);
          }
        } catch (supabaseError) {
          console.error('Supabase 서버 클라이언트 생성 실패:', supabaseError);
          console.log('Supabase 서버 클라이언트 생성 실패: 환경 변수 누락');
        }
        
        // JWT 토큰 검증 시도
        console.log('JWT 토큰 검증 시도...');
        console.log('JWT 토큰 검증 시도', token.substring(0, 10) + '...');
        
        try {
          const decoded = verifyToken(token);
          if (!decoded || !decoded.userId) {
            console.log('JWT 토큰도 유효하지 않음');
            
            // 개발 환경에서는 인증 에러를 무시하고 기본 사용자 ID(3)로 진행
            if (isDevelopment) {
              console.log('개발 환경에서 인증 우회, 기본 사용자 ID: 3 사용');
              userId = 3;
              return await getNotificationsForUser(userId, req);
            }
            
            throw new Error('유효하지 않은 인증 정보');
          }
          
          userId = decoded.userId;
          console.log('JWT 인증 성공, 사용자 ID:', userId);
          return await getNotificationsForUser(userId, req);
        } catch (jwtError) {
          console.log('JWT 토큰 검증 실패:', jwtError);
          
          // 개발 환경에서는 인증 에러를 무시하고 기본 사용자 ID(3)로 진행
          if (isDevelopment) {
            console.log('개발 환경에서 인증 우회, 기본 사용자 ID: 3 사용');
            userId = 3;
            return await getNotificationsForUser(userId, req);
          }
          
          throw new Error('모든 인증 방식 실패: ' + jwtError);
        }
      } catch (tokenError) {
        console.error('토큰 검증 중 오류:', tokenError);
        
        // 개발 환경에서는 인증 에러를 무시하고 기본 사용자 ID(3)로 진행
        if (isDevelopment) {
          console.log('개발 환경에서 인증 우회, 기본 사용자 ID: 3 사용');
          userId = 3;
          return await getNotificationsForUser(userId, req);
        }
        
        return new NextResponse(
          JSON.stringify({ 
            error: '인증에 실패했습니다.', 
            code: 'AUTH_ERROR',
            details: isDevelopment ? String(tokenError) : undefined
          }),
          { 
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
          }
        );
      }
    } else {
      // 토큰이 없는 경우
      if (isDevelopment) {
        console.log('개발 환경에서 인증 우회, 기본 사용자 ID: 3 사용');
        userId = 3; // 개발 환경에서 기본 사용자 ID
        return await getNotificationsForUser(userId, req);
      }
      
      return new NextResponse(
        JSON.stringify({ 
          error: '로그인이 필요합니다.', 
          code: 'AUTH_ERROR' 
        }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }
  } catch (error) {
    console.error('알림 API 전역 오류:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: '서버에서 오류가 발생했습니다.', 
        code: 'SERVER_ERROR',
        details: isDevelopment ? String(error) : undefined
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
  }
}

// 사용자의 알림을 조회하는 핵심 함수 (코드 재사용을 위해 분리)
async function getNotificationsForUser(userId: number, req?: Request) {
  try {
    console.log('알림 데이터 조회 시도...');
    console.log('조회 조건:', { userId });
    
    // 페이지네이션 파라미터 처리
    const url = req ? new URL(req.url) : new URL('http://localhost');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * pageSize;
    
    console.log('페이지네이션 정보:', { page, pageSize, skip });
    
    // Supabase로 알림 데이터 조회
    console.log('Supabase로 알림 데이터 조회...');
    
    // 모의 Supabase 클라이언트에서는 range 메서드가 지원되지 않을 수 있음
    let { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        post:posts(id, title)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('알림 조회 중 오류:', error);
      throw error;
    }

    // 모의 데이터가 비어있거나 구조적 문제가 있는 경우 기본 데이터 생성
    if (!notifications || notifications.length === 0 || !Array.isArray(notifications)) {
      console.log("알림 데이터 없음 또는 구조 문제, 기본 데이터 생성");
      // 기본 데이터로 대체 (개발 목적)
      notifications = [
        {
          id: 1,
          user_id: userId,
          post_id: null,
          message: "시스템 알림 예시입니다",
          is_read: false,
          type: "SYSTEM",
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          user_id: userId,
          post_id: null,
          message: "두 번째 알림 예시입니다",
          is_read: false,
          type: "SYSTEM",
          created_at: new Date().toISOString()
        }
      ];
    }
    
    // 수동 페이지네이션 구현
    const totalCount = notifications.length;
    // 페이지네이션된 알림만 추출
    notifications = notifications.slice(skip, skip + pageSize);

    console.log('조회된 알림 수:', notifications.length);
    console.log('원본 알림 데이터:', notifications);

    // 날짜를 상대적 표시로 변환하는 함수
    function formatDateToRelative(dateStr: string | undefined): string {
      if (!dateStr) return '방금 전';
      
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '방금 전';

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        
        // 미래 날짜인 경우 (서버 시간 차이 등으로 발생 가능)
        if (diffSeconds < 0) return '방금 전';
        
        if (diffSeconds < 60) return '방금 전';
        if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}분 전`;
        if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}시간 전`;
        if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}일 전`;
        
        // 1주일 이상인 경우 날짜 표시
        return date.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (error) {
        console.error('날짜 변환 오류:', error);
        return '방금 전';
      }
    }

    // 알림이 없으면 빈 배열 반환
    if (!notifications || notifications.length === 0) {
      console.log("알림 데이터 없음, 빈 배열 반환");
      return addCorsHeaders(NextResponse.json({
        success: true,
        notifications: [],
        pagination: {
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
          hasMore: false
        }
      }, { status: 200 }));
    }

    // Supabase에서 받은 데이터 형식에 맞게 가공
    const formattedNotifications = notifications.map(notification => {
      // 포스트 정보 처리 (Supabase에서의 중첩 객체 구조 처리)
      const postData = notification.post || {};
      
      return {
        id: notification.id,
        title: notification.title || '시스템 알림',
        message: notification.message,
        link: notification.post_id ? `/posts/${notification.post_id}` : '/mypage',
        isRead: notification.is_read,
        createdAt: notification.created_at,
        type: notification.type || 'SYSTEM',
        formattedDate: formatDateToRelative(notification.created_at)
      };
    });

    console.log("포맷된 알림 데이터:", formattedNotifications);

    return addCorsHeaders(NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
        hasMore: skip + notifications.length < totalCount
      }
    }, { status: 200 }));
  } catch (dbError) {
    console.error('데이터베이스 쿼리 오류:', dbError);
    return addCorsHeaders(NextResponse.json({ 
      error: '알림 데이터 조회 중 오류가 발생했습니다.', 
      code: 'DB_ERROR',
      details: isDevelopment ? String(dbError) : undefined
    }, { status: 500 }));
  }
}

// 알림 생성
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, postId, message, type = 'SYSTEM' } = body;

    if (!userId || !message) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }}
      );
    }

    try {
      console.log('Supabase로 알림 생성 시도...');
      
      // Supabase 데이터 형식으로 변환
      const notificationData = {
        user_id: userId,
        post_id: postId,
        message,
        type,
        is_read: false
      };
      
      const { data: supabaseNotification, error } = await supabase
        .from('notifications')
        .insert(notificationData)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase 알림 생성 오류:', error);
        throw error;
      }
      
      console.log('Supabase로 알림 생성 성공:', supabaseNotification);
      
      // Supabase 응답 형식을 앱 형식으로 변환
      const notification = {
        id: supabaseNotification.id,
        userId: supabaseNotification.user_id,
        postId: supabaseNotification.post_id,
        message: supabaseNotification.message,
        type: supabaseNotification.type,
        isRead: supabaseNotification.is_read,
        createdAt: new Date(supabaseNotification.created_at)
      };
      
      return NextResponse.json({ notification }, 
        { status: 201, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }}
      );
    } catch (error) {
      console.error('알림 생성 오류:', error);
      throw error;
    }
  } catch (error) {
    console.error('알림 생성 중 오류 발생:', error);
    return NextResponse.json(
      { error: '알림을 생성하는 중 오류가 발생했습니다.' },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }}
    );
  }
}

// 알림 읽음 상태 변경
export async function PATCH(req: Request) {
  try {
    // 요청 본문 파싱
    const body = await req.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: '알림 ID가 필요합니다.' },
        { status: 400, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }}
      );
    }

    // 토큰 확인
    const token = getTokenFromHeaders(req.headers) || getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }}
      );
    }

    // JWT 토큰 검증만 사용하도록 수정
    let userId: number | null = null;

    try {
      // JWT 토큰 검증
      console.log('JWT 토큰 검증 시도...');
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        console.log('JWT 토큰이 유효하지 않음');
        throw new Error('유효하지 않은 인증 정보');
      }
      userId = decoded.userId;
      console.log('JWT 인증 성공, 사용자 ID:', userId);
    } catch (authError) {
      console.error('인증 실패:', authError);
      return NextResponse.json(
        { error: '유효하지 않은 인증 정보입니다.' },
        { status: 401, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }}
      );
    }

    try {
      console.log('Supabase로 알림 확인 및 업데이트 시도...');
      
      // 알림 소유자 확인
      const { data: notification, error: fetchError } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('id', notificationId)
        .single();
      
      if (fetchError) {
        console.error('Supabase 알림 조회 오류:', fetchError);
        throw fetchError;
      }
      
      if (!notification) {
        return NextResponse.json(
          { error: '알림을 찾을 수 없습니다.' },
          { status: 404, headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }}
        );
      }

      if (notification.user_id !== userId) {
        return NextResponse.json(
          { error: '이 알림에 대한 권한이 없습니다.' },
          { status: 403, headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }}
        );
      }

      // 읽음 상태 업데이트
      const { data: updatedNotification, error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();
      
      if (updateError) {
        console.error('Supabase 알림 업데이트 오류:', updateError);
        throw updateError;
      }
      
      // Supabase 응답 형식을 앱 형식으로 변환
      const formattedNotification = {
        id: updatedNotification.id,
        userId: updatedNotification.user_id,
        postId: updatedNotification.post_id,
        message: updatedNotification.message,
        type: updatedNotification.type,
        isRead: updatedNotification.is_read,
        createdAt: new Date(updatedNotification.created_at)
      };
      
      return NextResponse.json(
        { success: true, notification: formattedNotification },
        { status: 200, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }}
      );
      
    } catch (error) {
      console.error('알림 업데이트 오류:', error);
      throw error;
    }
  } catch (error) {
    console.error('알림 업데이트 오류:', error);
    return NextResponse.json(
      { error: '알림 업데이트 중 오류가 발생했습니다.', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }}
    );
  }
} 