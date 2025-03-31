// 네트워크 연결 테스트 스크립트
const https = require('https');

// 일반적인 HTTPS 요청 테스트
function testHttpsRequest() {
  console.log('일반 HTTPS 요청 테스트 시작...');
  
  const options = {
    hostname: 'www.google.com',
    port: 443,
    path: '/',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 샘플만 출력
      console.log('응답 데이터 수신 중... (일부만 표시)');
    });
    
    res.on('end', () => {
      console.log('일반 HTTPS 요청 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('HTTPS 요청 오류:', error);
  });
  
  req.end();
}

// Supabase 도메인 테스트
function testSupabaseDomain() {
  console.log('\nSupabase 도메인 테스트 시작...');
  
  const options = {
    hostname: 'jdubrjczdyqatspojgu.supabase.co',
    port: 443,
    path: '/',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase 상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 샘플만 출력
      console.log('Supabase 응답 데이터 수신 중... (일부만 표시)');
    });
    
    res.on('end', () => {
      console.log('Supabase 도메인 테스트 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase 도메인 요청 오류:', error);
  });
  
  req.end();
}

// 테스트 실행
testHttpsRequest();
setTimeout(testSupabaseDomain, 2000); // 2초 후에 Supabase 도메인 테스트 