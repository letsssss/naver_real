import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')

    if (!sellerId) {
      return NextResponse.json(
        { error: '판매자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 판매자 평균 별점 조회
    const { data, error } = await supabase
      .from("seller_avg_rating")
      .select("avg_rating, review_count")
      .eq("seller_id", sellerId)
      .maybeSingle()

    if (error) {
      console.error('판매자 별점 조회 오류:', error)
      return NextResponse.json({
        avg_rating: 0,
        review_count: 0
      })
    }

    return NextResponse.json({
      avg_rating: data?.avg_rating || 0,
      review_count: data?.review_count || 0
    })

  } catch (error) {
    console.error('판매자 별점 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 