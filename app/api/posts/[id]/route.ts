import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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
    // params.id 비동기적으로 처리
    const id = parseInt(params.id as string)
    
    if (isNaN(id)) {
      return addCorsHeaders(NextResponse.json(
        { error: '유효하지 않은 게시글 ID입니다' },
        { status: 400 }
      ));
    }
    
    // 게시글 조회 - any 타입 캐스팅
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users (
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
        id: post.users?.id || '',
        name: post.users?.name || '',
        image: post.users?.profile_image || '',
      },
      _count: {
        comments: 0 // 댓글 기능은 아직 구현되지 않음
      }
    }
    
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
    console.log("게시물 삭제 API 호출됨");
    
    // 현재 인증된 사용자 정보 가져오기
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 사용자 ID:", authUser.id);

    const userId = authUser.id;
    const postId = parseInt(params.id);

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
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "게시물을 찾을 수 없습니다." },
        { status: 404 }
      ));
    }

    // 게시물 작성자 확인
    if (existingPost.user_id !== userId) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "게시물 삭제 권한이 없습니다." },
        { status: 403 }
      ));
    }

    // 게시물 삭제 (소프트 삭제)
    const { error: updateError } = await supabase
      .from('posts')
      .update({ is_deleted: true } as any)
      .eq('id', postId);

    if (updateError) {
      throw updateError;
    }

    console.log("게시물 삭제 성공:", postId);

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