// Supabase 대체 도메인 테스트
const https = require('https');

// Supabase 서비스 도메인 테스트
function testSupabaseServiceDomain() {
  console.log('Supabase 서비스 도메인 테스트 시작...');
  
  // 서비스 도메인 테스트
  const options = {
    hostname: 'app.supabase.com',
    port: 443,
    path: '/',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase 서비스 도메인 상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 수신 중임을 표시
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\nSupabase 서비스 도메인 테스트 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase 서비스 도메인 요청 오류:', error);
  });
  
  req.end();
}

// Supabase API 서비스 도메인 테스트
function testSupabaseApiServiceDomain() {
  console.log('\nSupabase API 서비스 도메인 테스트 시작...');
  
  const options = {
    hostname: 'supabase.co',
    port: 443,
    path: '/',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase API 서비스 도메인 상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 수신 중임을 표시
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\nSupabase API 서비스 도메인 테스트 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase API 서비스 도메인 요청 오류:', error);
  });
  
  req.end();
}

// Supabase 공용 API 도메인 테스트
function testSupabasePublicApiDomain() {
  console.log('\nSupabase 공용 API 도메인 테스트 시작...');
  
  const options = {
    hostname: 'supabase.com',
    port: 443,
    path: '/dashboard/project/' + 'jdubrjczdyqatspojgu',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase 공용 API 도메인 상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 수신 중임을 표시
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\nSupabase 공용 API 도메인 테스트 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase 공용 API 도메인 요청 오류:', error);
  });
  
  req.end();
}

// 테스트 실행
testSupabaseServiceDomain();
setTimeout(testSupabaseApiServiceDomain, 2000); // 2초 후
setTimeout(testSupabasePublicApiDomain, 4000); // 4초 후 