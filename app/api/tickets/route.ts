import { NextResponse } from "next/server"
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic' // 정적 경로 대신 동적 라우트 사용

export async function GET() {
  try {
    // 서버 사이드에서 Supabase 클라이언트 생성
    const supabase = createRouteHandlerClient({ cookies })
    
    // 티켓 정보 가져오기 - 콘서트 카테고리에 해당하는 게시물 조회
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select(`
        id, 
        title, 
        event_name,
        event_date,
        event_venue,
        category,
        ticket_price,
        status
      `)
      .eq("category", "콘서트")
      .eq("status", "판매중")
      
    if (postsError) {
      console.error("티켓 정보 조회 오류:", postsError)
      return NextResponse.json({ error: "티켓 정보를 불러올 수 없습니다." }, { status: 500 })
    }
    
    // 필요한 형식으로 데이터 변환
    const formattedTickets = posts.map(post => ({
      id: post.id,
      title: post.title || post.event_name || "제목 없음",
      artist: post.event_name || "",
      date: post.event_date || "",
      price: post.ticket_price || 0,
      venue: post.event_venue || "",
      quantity: 1, // 기본값 설정
    }))
    
    return NextResponse.json(formattedTickets)
  } catch (error) {
    console.error("티켓 API 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const newTicket = await request.json()
    // 서버 사이드에서 Supabase 클라이언트 생성
    const supabase = createRouteHandlerClient({ cookies })
    
    // 새로운 티켓 정보 삽입
    const { data, error } = await supabase
      .from("posts")
      .insert({
        title: newTicket.title,
        event_name: newTicket.artist,
        event_date: newTicket.date,
        ticket_price: newTicket.price,
        category: "콘서트",
        status: "판매중"
      })
      .select()
      .single()
      
    if (error) {
      console.error("티켓 생성 오류:", error)
      return NextResponse.json({ error: "티켓을 생성할 수 없습니다." }, { status: 500 })
    }
    
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("티켓 생성 API 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const updatedTicket = await request.json()
    // 서버 사이드에서 Supabase 클라이언트 생성
    const supabase = createRouteHandlerClient({ cookies })
    
    // 티켓 정보 업데이트
    const { data, error } = await supabase
      .from("posts")
      .update({
        title: updatedTicket.title,
        event_name: updatedTicket.artist,
        event_date: updatedTicket.date,
        ticket_price: updatedTicket.price
      })
      .eq("id", updatedTicket.id)
      .select()
      .single()
      
    if (error) {
      console.error("티켓 업데이트 오류:", error)
      return NextResponse.json({ error: "티켓을 업데이트할 수 없습니다." }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("티켓 업데이트 API 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    // 서버 사이드에서 Supabase 클라이언트 생성
    const supabase = createRouteHandlerClient({ cookies })
    
    // 티켓 삭제 (실제로는 상태 변경)
    const { error } = await supabase
      .from("posts")
      .update({ status: "삭제됨" })
      .eq("id", id)
      
    if (error) {
      console.error("티켓 삭제 오류:", error)
      return NextResponse.json({ error: "티켓을 삭제할 수 없습니다." }, { status: 500 })
    }
    
    return NextResponse.json({ message: "티켓이 성공적으로 삭제되었습니다." })
  } catch (error) {
    console.error("티켓 삭제 API 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

