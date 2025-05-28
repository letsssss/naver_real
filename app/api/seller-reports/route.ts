import { NextRequest, NextResponse } from 'next/server'
import { createBrowserClient } from '@/lib/supabase'

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

    const supabase = createBrowserClient()

    // 1. 해당 판매자의 게시물들을 먼저 조회
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id')
      .eq('author_id', sellerId)

    if (postsError) {
      console.error('게시물 조회 오류:', postsError)
      return NextResponse.json(
        { error: '게시물 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!posts || posts.length === 0) {
      // 게시물이 없으면 신고도 없음
      return NextResponse.json({
        hasReports: false,
        count: 0,
        reports: []
      })
    }

    const postIds = posts.map(post => post.id)

    // 2. 해당 게시물들에 대한 신고 조회
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select(`
        id,
        reason,
        status,
        created_at,
        post_id,
        reporter:reporter_id (
          id,
          name
        )
      `)
      .in('post_id', postIds)
      .order('created_at', { ascending: false })

    if (reportsError) {
      console.error('신고 조회 오류:', reportsError)
      return NextResponse.json(
        { error: '신고 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!reports || reports.length === 0) {
      return NextResponse.json({
        hasReports: false,
        count: 0,
        reports: []
      })
    }

    // 3. 신고 데이터 가공
    const reportCount = reports.length
    const reasons = [...new Set(reports.map(report => report.reason))]
    const lastReportDate = reports[0]?.created_at
    
    // 심각도 계산 (신고 건수 기준)
    let severity: 'low' | 'medium' | 'high' = 'low'
    if (reportCount >= 5) {
      severity = 'high'
    } else if (reportCount >= 2) {
      severity = 'medium'
    }

    // 상태 결정 (가장 최근 신고의 상태 기준)
    const latestStatus = reports[0]?.status || 'pending'
    let status: '검토중' | '해결됨' | '무효처리' = '검토중'
    
    switch (latestStatus) {
      case 'approved':
        status = '해결됨'
        break
      case 'rejected':
        status = '무효처리'
        break
      default:
        status = '검토중'
    }

    return NextResponse.json({
      hasReports: true,
      count: reportCount,
      severity,
      lastReportDate: lastReportDate ? new Date(lastReportDate).toLocaleDateString('ko-KR') : '',
      reasons,
      status,
      reports: reports.map(report => ({
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.created_at,
        postId: report.post_id,
        reporter: report.reporter
      }))
    })

  } catch (error) {
    console.error('판매자 신고 이력 조회 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 