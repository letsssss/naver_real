import { NextRequest, NextResponse } from 'next/server'
import { supabase, adminSupabase } from '@/lib/supabase'
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
  { params }: { params: { id: string } }
) {
  try {
    // params.id 비동기적으로 처리 (await 사용)
    const paramsId = await params.id;
    const id = parseInt(paramsId);
    
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
    
    // 사용자 정보 디버깅
    console.log("API - post 데이터:", post);
    console.log("API - post.user_id:", post.user_id);
    console.log("API - post.author_id:", post.author_id);
    
    // users 관계 확인
    console.log("API - post.users 객체:", post.users);
    
    // 사용자 정보 직접 조회 시도 (관계 쿼리가 작동하지 않을 경우)
    if (!post.users && (post.user_id || post.author_id)) {
      const userId = post.author_id || post.user_id;
      console.log("API - 사용자 정보 직접 조회 시도. userId:", userId);
      
      try {
        // 어드민 클라이언트로 조회 시도 (더 많은 권한)
        const { data: userData, error: userError } = await adminSupabase
          .from('users')
          .select('id, name, profile_image')
          .eq('id', userId)
          .single();
        
        if (!userError && userData) {
          console.log("API - 사용자 직접 조회 성공(어드민):", userData);
          post.users = userData;
        } else {
          console.log("API - 어드민 조회 실패, 일반 클라이언트로 재시도:", userError);
          
          // 일반 클라이언트로 다시 시도
          const { data: regUserData, error: regUserError } = await supabase
            .from('users')
            .select('id, name, profile_image')
            .eq('id', userId)
            .single();
          
          if (!regUserError && regUserData) {
            console.log("API - 사용자 직접 조회 성공(일반):", regUserData);
            post.users = regUserData;
          } else {
            console.log("API - 사용자 직접 조회 모두 실패:", regUserError);
          }
        }
      } catch (err) {
        console.error("API - 사용자 조회 중 예외 발생:", err);
      }
    }
    
    // 조회수 증가
    const { error: updateError } = await supabase
      .from('posts')
      .update({ view_count: (post.view_count || 0) + 1 } as any)
      .eq('id', id);
    
    if (updateError) {
      console.error('조회수 업데이트 오류:', updateError);
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
      author: {
        id: post.users?.id || post.author_id || post.user_id || '',
        name: post.users?.name || '',
        image: post.users?.profile_image || '',
      },
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
  { params }: { params: { id: string } }
) {
  try {
    // params.id 비동기적으로 처리 - await 추가
    const paramsId = await params.id;
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
          const { data: purchases, error: purchasesError } = await adminSupabase
            .from('purchases')
            .select('*')
            .eq('post_id', postId);
          
          if (purchasesError) {
            console.error("관련 구매 내역 조회 오류:", purchasesError);
          } else if (purchases && purchases.length > 0) {
            console.log(`게시물 ID ${postId}에 연결된 구매 내역 ${purchases.length}개 발견`);
            
            // 관련 구매 내역이 있으면 소프트 삭제로 전환 (외래 키 제약으로 인해)
            console.log("관련 구매 내역이 있어 소프트 삭제 진행");
            const { error: updateError } = await adminSupabase
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
          const { error: commentsError } = await adminSupabase
            .from('comments')
            .delete()
            .eq('post_id', postId);
          
          if (commentsError) {
            console.error("댓글 삭제 오류:", commentsError);
          } else {
            console.log("관련 댓글 삭제 완료");
          }
          
          // 3. 관련 좋아요 삭제
          const { error: likesError } = await adminSupabase
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
          const { error: deleteError } = await adminSupabase
            .from('posts')
            .delete()
            .eq('id', postId);
          
          if (deleteError) {
            console.error("하드 삭제 오류:", deleteError);
            
            // 하드 삭제 실패 시 소프트 삭제 시도
            console.log("하드 삭제 실패로 소프트 삭제 시도");
            const { error: updateError } = await adminSupabase
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
    const { data: purchases, error: purchasesError } = await adminSupabase
      .from('purchases')
      .select('*')
      .eq('post_id', postId);
    
    if (purchasesError) {
      console.error("관련 구매 내역 조회 오류:", purchasesError);
    } else if (purchases && purchases.length > 0) {
      console.log(`게시물 ID ${postId}에 연결된 구매 내역 ${purchases.length}개 발견`);
      
      // 관련 구매 내역이 있으면 소프트 삭제로 전환 (외래 키 제약으로 인해)
      console.log("관련 구매 내역이 있어 소프트 삭제 진행");
      const { error: updateError } = await adminSupabase
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
    const { error: commentsError } = await adminSupabase
      .from('comments')
      .delete()
      .eq('post_id', postId);
    
    if (commentsError) {
      console.error("댓글 삭제 오류:", commentsError);
    } else {
      console.log("관련 댓글 삭제 완료");
    }
    
    // 3. 관련 좋아요 삭제
    const { error: likesError } = await adminSupabase
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
    const { error: deleteError } = await adminSupabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (deleteError) {
      console.error("하드 삭제 오류:", deleteError);
      
      // 하드 삭제 실패 시 소프트 삭제 시도
      console.log("하드 삭제 실패로 소프트 삭제 시도");
      const { error: updateError } = await adminSupabase
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