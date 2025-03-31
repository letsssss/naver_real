const https = require('https');

// ping 테스트
const pingDomain = (domain) => {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://${domain}`, {
      timeout: 5000,
      rejectUnauthorized: false
    }, (res) => {
      console.log(`${domain} 응답: ${res.statusCode}`);
      resolve(res.statusCode);
    });

    req.on('error', (err) => {
      console.error(`${domain} 오류: ${err.message}`);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error(`${domain} 시간 초과`);
      reject(new Error('시간 초과'));
    });
  });
};

// 테스트할 도메인 목록
const domains = [
  'supabase.com',
  'supabase.io',
  'jdubrjczdyqqtsppojgu.supabase.co',
  'api.supabase.io',
  'app.supabase.io',
  'jdubrjczdyqqtsppojgu.supabase.io/rest/v1'
];

// 모든 도메인 테스트
console.log('도메인 접근성 테스트 시작...');
Promise.allSettled(domains.map(domain => pingDomain(domain)))
  .then(results => {
    console.log('\n테스트 결과 요약:');
    domains.forEach((domain, i) => {
      const status = results[i].status === 'fulfilled' 
        ? `성공 (${results[i].value})` 
        : `실패 (${results[i].reason?.message || '알 수 없는 오류'})`;
      console.log(`- ${domain}: ${status}`);
    });
  }); 