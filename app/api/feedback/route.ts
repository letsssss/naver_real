import { NextResponse } from "next/server"
import { getSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { feedback } = body

    if (!feedback || feedback.trim() === '') {
      return NextResponse.json({ 
        error: "피드백 내용이 필요합니다." 
      }, { status: 400 })
    }

    const supabaseClient = await getSupabaseClient()
    
    const { data, error } = await supabaseClient
      .from('feedback')
      .insert([
        {
          content: feedback.trim(),
          created_at: new Date().toISOString(),
          status: 'pending'
        }
      ])
      .select()

    if (error) {
      console.error("피드백 저장 오류:", error)
      return NextResponse.json({ 
        error: "피드백 저장에 실패했습니다." 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      message: "피드백이 성공적으로 저장되었습니다.",
      data 
    })

  } catch (error) {
    console.error("피드백 처리 중 오류:", error)
    return NextResponse.json({ 
      error: "서버 오류가 발생했습니다." 
    }, { status: 500 })
  }
}

