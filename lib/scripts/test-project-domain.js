// Supabase 프로젝트 도메인 테스트
const https = require('https');

// Supabase 프로젝트 도메인 테스트
function testSupabaseProjectDomain() {
  console.log('Supabase 프로젝트 도메인 테스트 시작...');
  
  const options = {
    hostname: 'jdubrjczdyqatspojgu.supabase.co',
    port: 443,
    path: '/',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase 프로젝트 도메인 상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 수신 중임을 표시
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\nSupabase 프로젝트 도메인 테스트 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase 프로젝트 도메인 요청 오류:', error);
  });
  
  req.end();
}

// Supabase REST API 테스트 (auth)
function testSupabaseRestApi() {
  console.log('\nSupabase REST API 테스트 시작...');
  
  const options = {
    hostname: 'jdubrjczdyqatspojgu.supabase.co',
    port: 443,
    path: '/rest/v1/',
    method: 'GET',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww'
    }
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase REST API 상태 코드: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\nSupabase REST API 테스트 결과:');
      try {
        console.log(data);
      } catch (e) {
        console.log('응답 데이터:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase REST API 요청 오류:', error);
  });
  
  req.end();
}

// 테스트 실행
testSupabaseProjectDomain();
setTimeout(testSupabaseRestApi, 2000); // 2초 후에 REST API 테스트 