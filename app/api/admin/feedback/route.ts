import { NextResponse } from "next/server"
import { getSupabaseClient } from '@/lib/supabase'

// 피드백 목록 조회
export async function GET() {
  try {
    const supabaseClient = await getSupabaseClient()

    const { data, error } = await supabaseClient
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error("피드백 조회 오류:", error)
      return NextResponse.json({ error: "피드백을 불러오는데 실패했습니다." }, { status: 500 })
    }

    return NextResponse.json({ feedbacks: data || [] }, { status: 200 })

  } catch (error) {
    console.error("피드백 조회 처리 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// 피드백 상태 업데이트
export async function PATCH(request: Request) {
  try {
    const { id, status, admin_notes } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: "ID와 상태가 필요합니다." }, { status: 400 })
    }

    // 유효한 상태인지 확인
    const validStatuses = ['pending', 'reviewed', 'resolved']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 })
    }

    const supabaseClient = await getSupabaseClient()

    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    }

    if (admin_notes !== undefined) {
      updateData.admin_notes = admin_notes
    }

    const { data, error } = await supabaseClient
      .from('feedback')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      console.error("피드백 업데이트 오류:", error)
      return NextResponse.json({ error: "피드백 업데이트에 실패했습니다." }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "해당 피드백을 찾을 수 없습니다." }, { status: 404 })
    }

    return NextResponse.json({ 
      message: "피드백이 성공적으로 업데이트되었습니다.",
      feedback: data[0]
    }, { status: 200 })

  } catch (error) {
    console.error("피드백 업데이트 처리 오류:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
} 