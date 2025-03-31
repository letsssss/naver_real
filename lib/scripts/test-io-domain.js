// Supabase IO 도메인 테스트
const https = require('https');

// Supabase IO 도메인 테스트
function testSupabaseIoDomain() {
  console.log('Supabase IO 도메인 테스트 시작...');
  
  const options = {
    hostname: 'jdubrjczdyqatspojgu.supabase.io',
    port: 443,
    path: '/',
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    console.log(`Supabase IO 도메인 상태 코드: ${res.statusCode}`);
    
    res.on('data', (d) => {
      // 데이터 수신 중임을 표시
      process.stdout.write('.');
    });
    
    res.on('end', () => {
      console.log('\nSupabase IO 도메인 테스트 성공!');
    });
  });
  
  req.on('error', (error) => {
    console.error('Supabase IO 도메인 요청 오류:', error);
  });
  
  req.end();
}

// 테스트 실행
testSupabaseIoDomain(); 