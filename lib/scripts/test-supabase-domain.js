// Supabase 기본 도메인 테스트
const https = require('https');

// Supabase 기본 도메인 테스트
function testSupabaseMainDomain() {
  console.log('Supabase 기본 도메인 테스트 시작...');
  
  const options = {
    hostname: 'supabase.com',
    port: 443,
    path: '/',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase 기본 도메인 상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 수신 중임을 표시
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\nSupabase 기본 도메인 테스트 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase 기본 도메인 요청 오류:', error);
  });
  
  req.end();
}

// API 도메인 테스트
function testSupabaseApiDomain() {
  console.log('\nSupabase API 도메인 테스트 시작...');
  
  const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: '/',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase API 도메인 상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 수신 중임을 표시
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\nSupabase API 도메인 테스트 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase API 도메인 요청 오류:', error);
  });
  
  req.end();
}

// 테스트 실행
testSupabaseMainDomain();
setTimeout(testSupabaseApiDomain, 2000); // 2초 후에 API 도메인 테스트 