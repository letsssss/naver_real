import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from "@/lib/auth"

// CORS 헤더 설정을 위한 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, DELETE, PUT');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

// 특정 게시글 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    
    // params를 먼저 await하고 그 다음 id에 접근
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    
    if (isNaN(id)) {
      return addCorsHeaders(NextResponse.json(
        { error: '유효하지 않은 게시글 ID입니다' },
        { status: 400 }
      ));
    }
    
    console.log("게시글 API - ID 조회:", id);
    
    // 게시글 조회 - any 타입 캐스팅
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users!posts_author_id_fkey (
          id, 
          name,
          profile_image
        )
      `)
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
      
    // 타입 캐스팅으로 타입스크립트 오류 처리
    const post = data as any;
    
    if (error || !post) {
      console.error('게시글 조회 오류:', error);
      return addCorsHeaders(NextResponse.json(
        { error: '게시글을 찾을 수 없습니다' },
        { status: 404 }
      ));
    }
    
    // 🚀 성능 최적화: 조회수 업데이트를 비동기로 처리 (응답 지연 방지)
    supabase
      .from('posts')
      .update({ view_count: (post.view_count || 0) + 1 } as any)
      .eq('id', id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('조회수 업데이트 오류:', updateError);
        }
      });
    
    // 🚀 성능 최적화: 사용자 정보 조회 간소화
    let authorInfo = {
      id: post.author_id || post.user_id || '',
      name: '판매자 정보 없음',
      image: ''
    };
    
    // 관계 쿼리가 성공한 경우
    if (post.users) {
      authorInfo = {
        id: post.users.id || post.author_id || post.user_id || '',
        name: post.users.name || '판매자 정보 없음',
        image: post.users.profile_image || ''
      };
    } else if (post.author_id || post.user_id) {
      // 관계 쿼리 실패 시 단일 조회 (중복 제거)
      const userId = post.author_id || post.user_id;
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, profile_image')
        .eq('id', userId)
        .single();
      
      if (userData) {
        authorInfo = {
          id: userData.id as string,
          name: (userData.name as string) || '판매자 정보 없음',
          image: (userData.profile_image as string) || ''
        };
      }
    }
    
    // 응답 형태 변환
    const formattedPost = {
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category || 'GENERAL',
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      viewCount: post.view_count || 0,
      status: post.status || 'ACTIVE',
      eventName: post.event_name || '',
      eventDate: post.event_date || '',
      eventVenue: post.event_venue || '',
      ticketPrice: post.ticket_price || 0,
      contactInfo: post.contact_info || '',
      isDeleted: post.is_deleted || false,
      author: authorInfo,
      _count: {
        comments: 0 // 댓글 기능은 아직 구현되지 않음
      }
    }
    
    console.log("API - 응답 데이터 author:", formattedPost.author);
    
    return addCorsHeaders(NextResponse.json({ post: formattedPost }));
  } catch (error) {
    console.error('게시글 조회 오류:', error)
    return addCorsHeaders(NextResponse.json(
      { error: '게시글 조회 중 오류가 발생했습니다' },
      { status: 500 }
    ));
  }
}

// 게시글 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    
    // params를 먼저 await하고 그 다음 id에 접근
    const resolvedParams = await params;
    const paramsId = resolvedParams.id;
    console.log("게시물 삭제 API 호출됨 - ID:", paramsId);
    
    // 현재 인증된 사용자 정보 가져오기
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      
      // 개발 환경에서는 쿼리 파라미터 userId 확인 (백업 방식)
      if (process.env.NODE_ENV === 'development') {
        const userId = request.nextUrl.searchParams.get('userId');
        if (userId) {
          console.log("개발 환경 - 쿼리 파라미터에서 userId 발견:", userId);
          
          // 사용자 ID를 사용하여 게시물 삭제 로직 진행
          const postId = parseInt(paramsId);
          
          if (isNaN(postId)) {
            return addCorsHeaders(NextResponse.json(
              { success: false, message: "유효하지 않은 게시물 ID입니다." },
              { status: 400 }
            ));
          }
          
          // 게시물 확인
          const { data, error: fetchError } = await supabase
            .from('posts')
            .select('*')
            .eq('id', postId)
            .single();
            
          const existingPost = data as any;
          
          if (fetchError || !existingPost) {
            console.error("게시물 조회 오류:", fetchError);
            return addCorsHeaders(NextResponse.json(
              { success: false, message: "게시물을 찾을 수 없습니다." },
              { status: 404 }
            ));
          }
          
          // 게시물 작성자 확인
          if (existingPost.author_id !== userId) {
            console.log("권한 오류: 게시물 작성자가 아님. 게시물 작성자:", existingPost.author_id, "요청 사용자:", userId);
            return addCorsHeaders(NextResponse.json(
              { success: false, message: "게시물 삭제 권한이 없습니다." },
              { status: 403 }
            ));
          }
          
          console.log("관련 데이터 정리 시작");
          
          // 1. 먼저 관련된 구매 내역 확인 (외래 키 제약 조건 확인용)
          const { data: purchases, error: purchasesError } = await supabase
            .from('purchases')
            .select('*')
            .eq('post_id', postId);
          
          if (purchasesError) {
            console.error("관련 구매 내역 조회 오류:", purchasesError);
          } else if (purchases && purchases.length > 0) {
            console.log(`게시물 ID ${postId}에 연결된 구매 내역 ${purchases.length}개 발견`);
            
            // 관련 구매 내역이 있으면 소프트 삭제로 전환 (외래 키 제약으로 인해)
            console.log("관련 구매 내역이 있어 소프트 삭제 진행");
            const { error: updateError } = await supabase
              .from('posts')
              .update({ is_deleted: true })
              .eq('id', postId);
            
            if (updateError) {
              console.error("소프트 삭제 오류:", updateError);
              throw updateError;
            }
            
            console.log("소프트 삭제 성공 (is_deleted=true)");
            
            return addCorsHeaders(NextResponse.json({ 
              success: true, 
              message: "게시물이 성공적으로 삭제 처리되었습니다.",
              info: "관련 구매 내역이 있어 소프트 삭제 처리되었습니다."
            }));
          }
          
          // 2. 관련 댓글 삭제
          const { error: commentsError } = await supabase
            .from('comments')
            .delete()
            .eq('post_id', postId);
          
          if (commentsError) {
            console.error("댓글 삭제 오류:", commentsError);
          } else {
            console.log("관련 댓글 삭제 완료");
          }
          
          // 2-1. TICKET_REQUEST 카테고리인 경우 proposals 삭제
          if (existingPost.category === 'TICKET_REQUEST') {
            console.log("TICKET_REQUEST 카테고리 - proposals 삭제 시작");
            const { error: proposalsError } = await supabase
              .from('proposals')
              .delete()
              .eq('post_id', postId);
            
            if (proposalsError) {
              console.error("proposals 삭제 오류:", proposalsError);
            } else {
              console.log("관련 proposals 삭제 완료");
            }
            
            // offers 테이블도 삭제
            console.log("TICKET_REQUEST 카테고리 - offers 삭제 시작");
            const { error: offersError } = await supabase
              .from('offers')
              .delete()
              .eq('post_id', postId);
            
            if (offersError) {
              console.error("offers 삭제 오류:", offersError);
            } else {
              console.log("관련 offers 삭제 완료");
            }
          }
          
          // 3. 관련 좋아요 삭제
          const { error: likesError } = await supabase
            .from('likes')
            .delete()
            .eq('post_id', postId);
          
          if (likesError) {
            console.error("좋아요 삭제 오류:", likesError);
          } else {
            console.log("관련 좋아요 삭제 완료");
          }
          
          // 4. 게시물 하드 삭제 시도
          console.log("adminSupabase로 하드 삭제 시도");
          const { error: deleteError } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId);
          
          if (deleteError) {
            console.error("하드 삭제 오류:", deleteError);
            
            // 하드 삭제 실패 시 소프트 삭제 시도
            console.log("하드 삭제 실패로 소프트 삭제 시도");
            const { error: updateError } = await supabase
              .from('posts')
              .update({ is_deleted: true })
              .eq('id', postId);
            
            if (updateError) {
              console.error("소프트 삭제 오류:", updateError);
              throw updateError;
            }
            
            console.log("소프트 삭제 성공 (is_deleted=true)");
            
            return addCorsHeaders(NextResponse.json({ 
              success: true, 
              message: "게시물이 성공적으로 삭제 처리되었습니다.",
              info: "외래 키 제약조건으로 인해 소프트 삭제 처리되었습니다."
            }));
          }
          
          console.log("개발 환경 - 게시물 하드 삭제 성공:", postId);
          
          return addCorsHeaders(NextResponse.json({ 
            success: true, 
            message: "게시물이 성공적으로 삭제되었습니다." 
          }));
        }
      }
      
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 사용자 ID:", authUser.id);

    const userId = authUser.id;
    const postId = parseInt(paramsId);

    if (isNaN(postId)) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "유효하지 않은 게시물 ID입니다." },
        { status: 400 }
      ));
    }

    // 게시물이 존재하는지 확인
    const { data, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();
      
    // 타입 캐스팅으로 타입스크립트 오류 처리  
    const existingPost = data as any;

    if (fetchError || !existingPost) {
      console.error("게시물 조회 오류:", fetchError);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "게시물을 찾을 수 없습니다." },
        { status: 404 }
      ));
    }

    // 게시물 작성자 확인
    if (existingPost.author_id !== userId) {
      console.log("권한 오류: 게시물 작성자가 아님. 게시물 작성자:", existingPost.author_id, "요청 사용자:", userId);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "게시물 삭제 권한이 없습니다." },
        { status: 403 }
      ));
    }

    console.log("관련 데이터 정리 시작");
    
    // 1. 먼저 관련된 구매 내역 확인 (외래 키 제약 조건 확인용)
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('*')
      .eq('post_id', postId);
    
    if (purchasesError) {
      console.error("관련 구매 내역 조회 오류:", purchasesError);
    } else if (purchases && purchases.length > 0) {
      console.log(`게시물 ID ${postId}에 연결된 구매 내역 ${purchases.length}개 발견`);
      
      // 관련 구매 내역이 있으면 소프트 삭제로 전환 (외래 키 제약으로 인해)
      console.log("관련 구매 내역이 있어 소프트 삭제 진행");
      const { error: updateError } = await supabase
        .from('posts')
        .update({ is_deleted: true })
        .eq('id', postId);
      
      if (updateError) {
        console.error("소프트 삭제 오류:", updateError);
        throw updateError;
      }
      
      console.log("소프트 삭제 성공 (is_deleted=true)");
      
      return addCorsHeaders(NextResponse.json({ 
        success: true, 
        message: "게시물이 성공적으로 삭제 처리되었습니다.",
        info: "관련 구매 내역이 있어 소프트 삭제 처리되었습니다."
      }));
    }
    
    // 2. 관련 댓글 삭제
    const { error: commentsError } = await supabase
      .from('comments')
      .delete()
      .eq('post_id', postId);
    
    if (commentsError) {
      console.error("댓글 삭제 오류:", commentsError);
    } else {
      console.log("관련 댓글 삭제 완료");
    }
    
    // 2-1. TICKET_REQUEST 카테고리인 경우 proposals 삭제
    if (existingPost.category === 'TICKET_REQUEST') {
      console.log("TICKET_REQUEST 카테고리 - proposals 삭제 시작");
      const { error: proposalsError } = await supabase
        .from('proposals')
        .delete()
        .eq('post_id', postId);
      
      if (proposalsError) {
        console.error("proposals 삭제 오류:", proposalsError);
      } else {
        console.log("관련 proposals 삭제 완료");
      }
      
      // offers 테이블도 삭제
      console.log("TICKET_REQUEST 카테고리 - offers 삭제 시작");
      const { error: offersError } = await supabase
        .from('offers')
        .delete()
        .eq('post_id', postId);
      
      if (offersError) {
        console.error("offers 삭제 오류:", offersError);
      } else {
        console.log("관련 offers 삭제 완료");
      }
    }
    
    // 3. 관련 좋아요 삭제
    const { error: likesError } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId);
    
    if (likesError) {
      console.error("좋아요 삭제 오류:", likesError);
    } else {
      console.log("관련 좋아요 삭제 완료");
    }
    
    // 4. 게시물 하드 삭제 시도
    console.log("adminSupabase로 하드 삭제 시도");
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (deleteError) {
      console.error("하드 삭제 오류:", deleteError);
      
      // 하드 삭제 실패 시 소프트 삭제 시도
      console.log("하드 삭제 실패로 소프트 삭제 시도");
      const { error: updateError } = await supabase
        .from('posts')
        .update({ is_deleted: true })
        .eq('id', postId);
      
      if (updateError) {
        console.error("소프트 삭제 오류:", updateError);
        throw updateError;
      }
      
      console.log("소프트 삭제 성공 (is_deleted=true)");
      
      return addCorsHeaders(NextResponse.json({ 
        success: true, 
        message: "게시물이 성공적으로 삭제 처리되었습니다.",
        info: "외래 키 제약조건으로 인해 소프트 삭제 처리되었습니다."
      }));
    }

    console.log("게시물 하드 삭제 성공:", postId);

    return addCorsHeaders(NextResponse.json({ 
      success: true, 
      message: "게시물이 성공적으로 삭제되었습니다." 
    }));
  } catch (error) {
    console.error("게시물 삭제 오류:", error);
    return addCorsHeaders(NextResponse.json(
      { success: false, message: "게시물 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    ));
  }
}

// CORS Preflight 요청 처리
export async function OPTIONS() {
  return addCorsHeaders(NextResponse.json({}));
} 