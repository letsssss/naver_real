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

    // 판매자에 대한 직접 신고 조회 (seller_id 필드 사용)
    const { data: sellerReports, error: sellerReportsError } = await supabase
      .from('reports')
      .select(`
        id,
        reason,
        status,
        created_at,
        type,
        reporter:reporter_id (
          id,
          name
        )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })

    // seller_id 필드가 없는 경우를 대비해 게시물 기반 신고도 조회
    let postBasedReports = []
    if (!sellerReports || sellerReports.length === 0) {
      // 1. 해당 판매자의 게시물들을 먼저 조회
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id')
        .eq('author_id', sellerId)

      if (!postsError && posts && posts.length > 0) {
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
            type,
            reporter:reporter_id (
              id,
              name
            )
          `)
          .in('post_id', postIds)
          .order('created_at', { ascending: false })

        if (!reportsError && reports) {
          postBasedReports = reports
        }
      }
    }

    // 두 종류의 신고를 합치기
    const allReports = [...(sellerReports || []), ...postBasedReports]

    if (allReports.length === 0) {
      return NextResponse.json({
        hasReports: false,
        count: 0,
        reports: []
      })
    }

    // 3. 신고 데이터 가공
    const reportCount = allReports.length
    const reasons = [...new Set(allReports.map(report => report.reason))]
    const lastReportDate = allReports[0]?.created_at
    
    // 심각도 계산 (신고 건수 기준)
    let severity: 'low' | 'medium' | 'high' = 'low'
    if (reportCount >= 5) {
      severity = 'high'
    } else if (reportCount >= 2) {
      severity = 'medium'
    }

    // 상태 결정 (가장 최근 신고의 상태 기준)
    const latestStatus = allReports[0]?.status || 'pending'
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
      reports: allReports.map(report => ({
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.created_at,
        postId: report.post_id || null,
        type: report.type || 'seller',
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