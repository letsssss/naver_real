// Supabase 연결 테스트 스크립트
const { createClient } = require('@supabase/supabase-js')

// 하드코딩된 값 사용
const supabaseUrl = 'https://jdubrjczdyqatspojgu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww'

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Anon Key 길이:', supabaseAnonKey.length)

// Supabase 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 간단한 연결 테스트
async function testConnection() {
  console.log('Supabase 연결 테스트 시작...')
  
  try {
    // Supabase 시스템 테이블 조회 시도
    const { data, error } = await supabase
      .from('_prisma_migrations')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('Supabase 연결 오류:', error)
    } else {
      console.log('Supabase 연결 성공!')
      console.log('데이터 샘플:', data)
    }
  } catch (err) {
    console.error('예외 발생:', err)
  }
}

testConnection() 