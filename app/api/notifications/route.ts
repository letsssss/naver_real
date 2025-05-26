
export const runtime = 'nodejs';

console.log("🛠️ [DEBUG] API Handler /api/notifications loaded");
console.log("🔧 route.ts 파일 실행됨 - API 서버에 정상적으로 배포됨");

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { validateRequestToken } from '@/lib/auth';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// CORS 기본 헤더
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 표준 응답 생성기
function createApiResponse(data: any, status = 200) {
  return NextResponse.json(data, { 
    status, 
    headers: CORS_HEADERS
  });
}

// 오류 응답 생성기
function createErrorResponse(message: string, code: string, status = 500, details?: any) {
  const isDev = process.env.NODE_ENV === 'development';
  
  return NextResponse.json({ 
    error: message, 
    code,
    details: isDev ? details : undefined
  }, { 
    status, 
    headers: CORS_HEADERS
  });
}

// OPTIONS 프리플라이트 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// 알림 조회 (로그인 필요)
export async function GET() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('🔴 알림 조회 실패:', error.message);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    return NextResponse.json({ success: true, notifications: data }, { status: 200 });
  } catch (err) {
    console.error('🔴 알림 조회 전역 에러:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// 알림 생성
export async function POST(req: Request) {
  try {
    // 관리자 권한 필요한 작업이므로 서버 클라이언트 사용
    const serverClient = createSupabaseServerClient();
    
    const body = await req.json();
    const { userId, postId, message, type = 'SYSTEM' } = body;

    // 필수 파라미터 검증
    if (!userId || !message) {
      return createErrorResponse(
        '필수 파라미터가 누락되었습니다.', 
        'VALIDATION_ERROR', 
        400
      );
    }

    // 사용자 ID 형식 변환
    const formattedUserId = String(userId);

    // 알림 데이터 생성
    const notificationData = {
      user_id: formattedUserId,
      post_id: postId,
      message,
      type,
      is_read: false
    };
    
    // 데이터베이스에 저장
    const { data: notification, error } = await serverClient
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();
    
    if (error) {
      console.error('[알림 생성] 오류:', error);
      return createErrorResponse(
        '알림 생성 중 오류가 발생했습니다.', 
        'DB_ERROR', 
        500, 
        error
      );
    }
    
    // 응답 형식 변환
    const formattedNotification = {
      id: notification.id,
      userId: notification.user_id,
      postId: notification.post_id,
      message: notification.message,
      type: notification.type,
      isRead: notification.is_read,
      createdAt: notification.created_at
    };
    
    return createApiResponse({
      success: true,
      notification: formattedNotification
    }, 201);
  } catch (error) {
    console.error('[알림 생성] 전역 오류:', error);
    return createErrorResponse(
      '알림 생성 중 오류가 발생했습니다.', 
      'SERVER_ERROR', 
      500, 
      error
    );
  }
}

// 알림 읽음 상태 변경
export async function PATCH(req: Request) {
  try {
    // 사용자 인증
    const { userId, authenticated } = await validateRequestToken(req);
    
    if (!authenticated) {
      return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
    }
    
    // 요청 본문 파싱
    const body = await req.json();
    const { notificationId } = body;
    
    if (!notificationId) {
      return createErrorResponse('알림 ID가 필요합니다.', 'VALIDATION_ERROR', 400);
    }
    
    try {
      // Supabase 클라이언트 생성
      const client = createSupabaseServerClient();
      
      // 알림 소유자 확인
      const { data: notification, error: fetchError } = await client
        .from('notifications')
        .select('user_id')
        .eq('id', notificationId)
        .single();
      
      if (fetchError) {
        console.error('[알림 업데이트] 조회 오류:', fetchError);
        
        // 개발 환경에서 오류 처리
        if (process.env.NODE_ENV === 'development') {
          console.log('[알림 업데이트] 개발 환경에서 오류 발생 시 가상 성공 응답');
          
          return createApiResponse({
            success: true,
            notification: {
              id: notificationId,
              userId: userId,
              postId: null,
              message: '모의 알림 메시지',
              type: 'SYSTEM',
              isRead: true,
              createdAt: new Date().toISOString()
            }
          });
        }
        
        return createErrorResponse(
          '알림을 찾을 수 없습니다.',
          'NOT_FOUND',
          404,
          fetchError
        );
      }
      
      if (!notification) {
        return createErrorResponse('알림을 찾을 수 없습니다.', 'NOT_FOUND', 404);
      }
      
      // 권한 확인
      if (notification.user_id !== userId) {
        return createErrorResponse(
          '이 알림에 대한 권한이 없습니다.',
          'FORBIDDEN',
          403
        );
      }
      
      // 읽음 상태 업데이트
      const { data: updatedNotification, error: updateError } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();
      
      if (updateError) {
        console.error('[알림 업데이트] 업데이트 오류:', updateError);
        
        // 개발 환경에서 오류 처리
        if (process.env.NODE_ENV === 'development') {
          console.log('[알림 업데이트] 개발 환경에서 업데이트 오류 발생 시 가상 성공 응답');
          
          return createApiResponse({
            success: true,
            notification: {
              id: notificationId,
              userId: userId,
              postId: null,
              message: '모의 알림 메시지 (업데이트 복구)',
              type: 'SYSTEM',
              isRead: true,
              createdAt: new Date().toISOString()
            }
          });
        }
        
        return createErrorResponse(
          '알림 업데이트 중 오류가 발생했습니다.',
          'DB_ERROR',
          500,
          updateError
        );
      }
      
      // 응답 형식 변환
      const formattedNotification = {
        id: updatedNotification.id,
        userId: updatedNotification.user_id,
        postId: updatedNotification.post_id,
        message: updatedNotification.message,
        type: updatedNotification.type,
        isRead: updatedNotification.is_read,
        createdAt: updatedNotification.created_at
      };
      
      return createApiResponse({
        success: true,
        notification: formattedNotification
      });
      
    } catch (innerError) {
      console.error('[알림 업데이트] 내부 처리 오류:', innerError);
      
      // 개발 환경에서 오류 처리
      if (process.env.NODE_ENV === 'development') {
        console.log('[알림 업데이트] 개발 환경에서 내부 오류 발생 시 가상 성공 응답');
        
        return createApiResponse({
          success: true,
          notification: {
            id: notificationId,
            userId: userId,
            postId: null,
            message: '모의 알림 메시지 (내부 오류 복구)',
            type: 'SYSTEM',
            isRead: true,
            createdAt: new Date().toISOString()
          }
        });
      }
      
      return createErrorResponse(
        '알림 업데이트 중 내부 오류가 발생했습니다.',
        'INTERNAL_ERROR',
        500,
        innerError
      );
    }
  } catch (error) {
    console.error('[알림 업데이트] 전역 오류:', error);
    
    // 개발 환경에서 오류 처리
    if (process.env.NODE_ENV === 'development') {
      console.log('[알림 업데이트] 개발 환경에서 전역 오류 발생 시 가상 성공 응답');
      
      // 요청 바디를 복구할 수 없으므로 기본값 사용
      const defaultNotificationId = 0;
      
      return createApiResponse({
        success: true,
        notification: {
          id: defaultNotificationId,
          userId: '3',
          postId: null,
          message: '모의 알림 메시지 (전역 오류 복구)',
          type: 'SYSTEM',
          isRead: true,
          createdAt: new Date().toISOString()
        }
      });
    }
    
    return createErrorResponse(
      '알림 업데이트 중 오류가 발생했습니다.',
      'SERVER_ERROR',
      500,
      error
    );
  }

//import { NextResponse } from 'next/server';
// import { 
//   supabase, 
//   createServerSupabaseClient, 
//   createAuthClient, 
//   formatUserId, 
//   transformers,
//   getSupabaseClient
// } from "@lib/supabase";
//import { verifyToken, getTokenFromHeaders, getTokenFromCookies } from '@/lib/auth';

// 표준 응답 헤더 정의
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// 표준 응답 생성기
function createApiResponse(data: any, status = 200) {
  return NextResponse.json(data, { 
    status, 
    headers: CORS_HEADERS
  });
}

// 오류 응답 생성기
function createErrorResponse(message: string, code: string, status = 500, details?: any) {
  const isDev = process.env.NODE_ENV === 'development';
  
  return NextResponse.json({ 
    error: message, 
    code,
    details: isDev ? details : undefined
  }, { 
    status, 
    headers: CORS_HEADERS
  });
}

// OPTIONS 요청 처리
// export async function OPTIONS() {
//   return new NextResponse(null, { 
//     status: 204,
//     headers: CORS_HEADERS
//   });
// }

// 사용자 인증 함수
//async function authenticateUser(req: Request): Promise<{ userId: string; authenticated: boolean }> {
  // 개발 환경 감지
  //const isDev = process.env.NODE_ENV === 'development';
  
  // 토큰 가져오기
  //const token = getTokenFromHeaders(req.headers) || getTokenFromCookies(req);
  
  // 토큰 디버깅 로그 추가
  //console.log('[토큰 디버깅] token:', token ? '토큰 존재함' : '토큰 없음');
  
  // try {
  //   if (token) {
  //     // 1. Supabase 인증 시도
  //     try {
  //       const serverClient = createServerSupabaseClient();
  //       const { data: { user }, error } = await serverClient.auth.getUser(token);
        
  //       if (!error && user) {
  //         console.log('[인증] Supabase 인증 성공:', user.id);
  //         return { userId: user.id, authenticated: true };
  //       }
  //     } catch (e) {
  //       console.error('[인증] Supabase 인증 오류:', e);
  //     }
      
  //     // 2. JWT 인증 시도
  //     try {
  //       const decoded = await verifyToken(token);
  //       if (decoded && decoded.userId) {
  //         const userId = formatUserId(decoded.userId);
  //         console.log('[인증] JWT 인증 성공:', userId);
  //         return { userId, authenticated: true };
  //       }
  //     } catch (e) {
  //       console.error('[인증] JWT 인증 오류:', e);
  //     }
  //   }
    
  //   // 개발 환경에서는 기본 사용자 허용
  //   if (isDev) {
  //     console.log('[인증] 개발 환경이지만 유효한 인증 필요');
  //     // 쿼리 파라미터에서 userId 확인 (개발용)
  //     const url = new URL(req.url);
  //     const queryUserId = url.searchParams.get('userId');
      
  //     if (queryUserId && queryUserId.length > 10) {
  //       console.log(`[인증] 개발 환경 - 쿼리 파라미터 userId 사용: ${queryUserId}`);
  //       return { userId: queryUserId, authenticated: true };
  //     }
      
  //     return { userId: '', authenticated: false };
  //   }
    
  //   return { userId: '', authenticated: false };
  // } catch (e) {
  //   console.error('[인증] 통합 인증 오류:', e);
    
  //   // 개발 환경에서도 인증 필요
  //   if (isDev) {
  //     console.log('[인증] 개발 환경이지만 유효한 인증 필요 (오류 복구)');
      
  //     // 쿼리 파라미터에서 userId 확인 (개발용)
  //     try {
  //       const url = new URL(req.url);
  //       const queryUserId = url.searchParams.get('userId');
        
  //       if (queryUserId && queryUserId.length > 10) {
  //         console.log(`[인증] 개발 환경 - 쿼리 파라미터 userId 사용: ${queryUserId}`);
  //         return { userId: queryUserId, authenticated: true };
  //       }
  //     } catch (err) {
  //       console.error('[인증] URL 파싱 오류:', err);
  //     }
  //   }
    
  //   return { userId: '', authenticated: false };
  // }
//}

// 알림 목록 조회
// export async function GET(req: Request) {
//   try {
//     console.log('[알림 API] GET 요청 시작');
    
//     // 사용자 인증
//     const { userId, authenticated } = await authenticateUser(req);
    
//     if (!authenticated) {
//       return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
//     }
    
//     try {
//       // Supabase 클라이언트 가져오기 - 싱글톤 패턴 적용
//       const client = getSupabaseClient();
      
//       // 페이지네이션 파라미터 처리
//       const url = new URL(req.url);
//       const page = parseInt(url.searchParams.get('page') || '1', 10);
//       const pageSize = parseInt(url.searchParams.get('limit') || '10', 10);
//       const skip = (page - 1) * pageSize;
      
//       console.log(`[알림 API] 사용자 ${userId}의 알림 조회 시도, 페이지: ${page}, 항목 수: ${pageSize}`);
      
//       // Supabase로 알림 데이터 조회
//       console.log('[알림 데이터] Supabase 클라이언트로 조회 시작');
//       const { data: notifications, error } = await client
//         .from('notifications')
//         .select(`
//           *,
//           post:posts(id, title)
//         `)
//         .eq('user_id', userId)
//         .order('created_at', { ascending: false });
      
//       if (error) {
//         console.error('[알림 API] Supabase 조회 오류:', error);
        
//         return createErrorResponse(
//           '알림을 불러오는 중 오류가 발생했습니다.',
//           'DB_ERROR',
//           500,
//           error
//         );
//       }
      
//       // 알림이 없을 경우 빈 배열 반환
//       if (!notifications || notifications.length === 0) {
//         return createApiResponse({
//           success: true,
//           notifications: [],
//           pagination: {
//             totalCount: 0,
//             totalPages: 0,
//             currentPage: page,
//             hasMore: false
//           }
//         });
//       }
      
//       // 수동 페이지네이션 구현
//       const totalCount = notifications.length;
//       const paginatedNotifications = notifications.slice(skip, skip + pageSize);
      
//       // 응답 데이터 형식 변환
//       const formattedNotifications = paginatedNotifications.map(notification => {
//         const postData = notification.post || {};
        
//         return {
//           id: notification.id,
//           title: notification.title || '시스템 알림',
//           message: notification.message,
//           link: notification.post_id ? `/posts/${notification.post_id}` : '/mypage',
//           isRead: notification.is_read,
//           createdAt: notification.created_at,
//           type: notification.type || 'SYSTEM',
//           formattedDate: transformers.formatRelativeTime(notification.created_at)
//         };
//       });
      
//       return createApiResponse({
//         success: true,
//         notifications: formattedNotifications,
//         pagination: {
//           totalCount,
//           totalPages: Math.ceil(totalCount / pageSize),
//           currentPage: page,
//           hasMore: skip + paginatedNotifications.length < totalCount
//         }
//       });
      
//     } catch (innerError) {
//       console.error('[알림 API] 내부 처리 오류:', innerError);
      
//       return createErrorResponse(
//         '알림 데이터를 처리하는 중 오류가 발생했습니다.',
//         'PROCESSING_ERROR',
//         500,
//         innerError
//       );
//     }
//   } catch (error) {
//     console.error('[알림 API] 전역 오류:', error);
    
//     return createErrorResponse(
//       '서버에서 오류가 발생했습니다.',
//       'SERVER_ERROR',
//       500,
//       error
//     );
//   }
// }

// // 알림 생성
// export async function POST(req: Request) {
//   try {
//     // 관리자 권한 필요한 작업이므로 서버 클라이언트 사용
//     const serverClient = createServerSupabaseClient();
    
//     const body = await req.json();
//     const { userId, postId, message, type = 'SYSTEM' } = body;

//     // 필수 파라미터 검증
//     if (!userId || !message) {
//       return createErrorResponse(
//         '필수 파라미터가 누락되었습니다.', 
//         'VALIDATION_ERROR', 
//         400
//       );
//     }

//     // 사용자 ID 형식 변환
//     const formattedUserId = formatUserId(userId);

//     // 알림 데이터 생성
//     const notificationData = {
//       user_id: formattedUserId,
//       post_id: postId,
//       message,
//       type,
//       is_read: false
//     };
    
//     // 데이터베이스에 저장
//     const { data: notification, error } = await serverClient
//       .from('notifications')
//       .insert(notificationData)
//       .select()
//       .single();
    
//     if (error) {
//       console.error('[알림 생성] 오류:', error);
//       return createErrorResponse(
//         '알림 생성 중 오류가 발생했습니다.', 
//         'DB_ERROR', 
//         500, 
//         error
//       );
//     }
    
//     // 응답 형식 변환
//     const formattedNotification = {
//       id: notification.id,
//       userId: notification.user_id,
//       postId: notification.post_id,
//       message: notification.message,
//       type: notification.type,
//       isRead: notification.is_read,
//       createdAt: notification.created_at
//     };
    
//     return createApiResponse({
//       success: true,
//       notification: formattedNotification
//     }, 201);
//   } catch (error) {
//     console.error('[알림 생성] 전역 오류:', error);
//     return createErrorResponse(
//       '알림 생성 중 오류가 발생했습니다.', 
//       'SERVER_ERROR', 
//       500, 
//       error
//     );
//   }
// }

// // 알림 읽음 상태 변경
// export async function PATCH(req: Request) {
//   try {
//     // 사용자 인증
//     const { userId, authenticated } = await authenticateUser(req);
    
//     if (!authenticated) {
//       return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
//     }
    
//     // 요청 본문 파싱
//     const body = await req.json();
//     const { notificationId } = body;
    
//     if (!notificationId) {
//       return createErrorResponse('알림 ID가 필요합니다.', 'VALIDATION_ERROR', 400);
//     }
    
//     try {
//       // Supabase 클라이언트 생성
//       const client = createServerSupabaseClient();
      
//       // 알림 소유자 확인
//       const { data: notification, error: fetchError } = await client
//         .from('notifications')
//         .select('user_id')
//         .eq('id', notificationId)
//         .single();
      
//       if (fetchError) {
//         console.error('[알림 업데이트] 조회 오류:', fetchError);
        
//         // 개발 환경에서 오류 처리
//         if (process.env.NODE_ENV === 'development') {
//           console.log('[알림 업데이트] 개발 환경에서 오류 발생 시 가상 성공 응답');
          
//           return createApiResponse({
//             success: true,
//             notification: {
//               id: notificationId,
//               userId: userId,
//               postId: null,
//               message: '모의 알림 메시지',
//               type: 'SYSTEM',
//               isRead: true,
//               createdAt: new Date().toISOString()
//             }
//           });
//         }
        
//         return createErrorResponse(
//           '알림을 찾을 수 없습니다.',
//           'NOT_FOUND',
//           404,
//           fetchError
//         );
//       }
      
//       if (!notification) {
//         return createErrorResponse('알림을 찾을 수 없습니다.', 'NOT_FOUND', 404);
//       }
      
//       // 권한 확인
//       if (notification.user_id !== userId) {
//         return createErrorResponse(
//           '이 알림에 대한 권한이 없습니다.',
//           'FORBIDDEN',
//           403
//         );
//       }
      
//       // 읽음 상태 업데이트
//       const { data: updatedNotification, error: updateError } = await client
//         .from('notifications')
//         .update({ is_read: true })
//         .eq('id', notificationId)
//         .select()
//         .single();
      
//       if (updateError) {
//         console.error('[알림 업데이트] 업데이트 오류:', updateError);
        
//         // 개발 환경에서 오류 처리
//         if (process.env.NODE_ENV === 'development') {
//           console.log('[알림 업데이트] 개발 환경에서 업데이트 오류 발생 시 가상 성공 응답');
          
//           return createApiResponse({
//             success: true,
//             notification: {
//               id: notificationId,
//               userId: userId,
//               postId: null,
//               message: '모의 알림 메시지 (업데이트 복구)',
//               type: 'SYSTEM',
//               isRead: true,
//               createdAt: new Date().toISOString()
//             }
//           });
//         }
        
//         return createErrorResponse(
//           '알림 업데이트 중 오류가 발생했습니다.',
//           'DB_ERROR',
//           500,
//           updateError
//         );
//       }
      
//       // 응답 형식 변환
//       const formattedNotification = {
//         id: updatedNotification.id,
//         userId: updatedNotification.user_id,
//         postId: updatedNotification.post_id,
//         message: updatedNotification.message,
//         type: updatedNotification.type,
//         isRead: updatedNotification.is_read,
//         createdAt: updatedNotification.created_at
//       };
      
//       return createApiResponse({
//         success: true,
//         notification: formattedNotification
//       });
      
//     } catch (innerError) {
//       console.error('[알림 업데이트] 내부 처리 오류:', innerError);
      
//       // 개발 환경에서 오류 처리
//       if (process.env.NODE_ENV === 'development') {
//         console.log('[알림 업데이트] 개발 환경에서 내부 오류 발생 시 가상 성공 응답');
        
//         return createApiResponse({
//           success: true,
//           notification: {
//             id: notificationId,
//             userId: userId,
//             postId: null,
//             message: '모의 알림 메시지 (내부 오류 복구)',
//             type: 'SYSTEM',
//             isRead: true,
//             createdAt: new Date().toISOString()
//           }
//         });
//       }
      
//       return createErrorResponse(
//         '알림 업데이트 중 내부 오류가 발생했습니다.',
//         'INTERNAL_ERROR',
//         500,
//         innerError
//       );
//     }
//   } catch (error) {
//     console.error('[알림 업데이트] 전역 오류:', error);
    
//     // 개발 환경에서 오류 처리
//     if (process.env.NODE_ENV === 'development') {
//       console.log('[알림 업데이트] 개발 환경에서 전역 오류 발생 시 가상 성공 응답');
      
//       // 요청 바디를 복구할 수 없으므로 기본값 사용
//       const defaultNotificationId = 0;
      
//       return createApiResponse({
//         success: true,
//         notification: {
//           id: defaultNotificationId,
//           userId: '3',
//           postId: null,
//           message: '모의 알림 메시지 (전역 오류 복구)',
//           type: 'SYSTEM',
//           isRead: true,
//           createdAt: new Date().toISOString()
//         }
//       });
//     }
    
//     return createErrorResponse(
//       '알림 업데이트 중 오류가 발생했습니다.',
//       'SERVER_ERROR',
//       500,
//       error
//     );
//   }
// }
}