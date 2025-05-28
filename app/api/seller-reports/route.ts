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

    // 🚀 성능 최적화: 단일 쿼리로 모든 신고 데이터 조회
    // RPC 함수를 사용하여 서버 측에서 복잡한 로직 처리
    const { data: reportData, error } = await supabase
      .rpc('get_seller_reports_optimized', {
        seller_id_param: sellerId
      })

    if (error) {
      console.error('최적화된 신고 조회 오류:', error)
      
      // 폴백: 기존 방식으로 처리 (하지만 더 효율적으로)
      const [sellerReportsResult, postsResult] = await Promise.allSettled([
        // 직접 신고 조회
        supabase
          .from('reports')
          .select('id, reason, status, created_at, type')
          .eq('seller_id', sellerId)
          .order('created_at', { ascending: false }),
        
        // 판매자 게시물 조회
        supabase
          .from('posts')
          .select('id')
          .eq('author_id', sellerId)
      ])

      let allReports = []

      // 직접 신고 결과 처리
      if (sellerReportsResult.status === 'fulfilled' && sellerReportsResult.value.data) {
        allReports.push(...sellerReportsResult.value.data)
      }

      // 게시물 기반 신고 조회 (직접 신고가 없는 경우에만)
      if (allReports.length === 0 && postsResult.status === 'fulfilled' && postsResult.value.data) {
        const postIds = postsResult.value.data.map(post => post.id)
        
        if (postIds.length > 0) {
          const { data: postReports } = await supabase
            .from('reports')
            .select('id, reason, status, created_at, post_id, type')
            .in('post_id', postIds)
            .order('created_at', { ascending: false })
          
          if (postReports) {
            allReports.push(...postReports)
          }
        }
      }

      if (allReports.length === 0) {
        return NextResponse.json({
          hasReports: false,
          count: 0,
          reports: []
        })
      }

      // 신고 데이터 가공
      const reportCount = allReports.length
      const reasons = [...new Set(allReports.map(report => report.reason))]
      const lastReportDate = allReports[0]?.created_at
      
      // 심각도 계산
      let severity: 'low' | 'medium' | 'high' = 'medium'
      if (reportCount >= 5) {
        severity = 'high'
      } else if (reportCount >= 1) {
        severity = 'medium'
      }

      // 상태 결정
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
          type: report.type || 'seller'
        }))
      })
    }

    // RPC 함수 성공 시 결과 처리
    if (!reportData || reportData.length === 0) {
      return NextResponse.json({
        hasReports: false,
        count: 0,
        reports: []
      })
    }

    const reportCount = reportData.length
    const reasons = [...new Set(reportData.map(report => report.reason))]
    const lastReportDate = reportData[0]?.created_at
    
    // 심각도 계산
    let severity: 'low' | 'medium' | 'high' = 'medium'
    if (reportCount >= 5) {
      severity = 'high'
    } else if (reportCount >= 1) {
      severity = 'medium'
    }

    // 상태 결정
    const latestStatus = reportData[0]?.status || 'pending'
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
      reports: reportData.map(report => ({
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.created_at,
        postId: report.post_id || null,
        type: report.type || 'seller'
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