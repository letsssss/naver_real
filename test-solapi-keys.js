const { SolapiMessageService } = require('solapi');

// 환경 변수에서 API 키 가져오기
const apiKey = process.env.SOLAPI_API_KEY || 'NCSLR9HLUEOHFVAK';
const apiSecret = process.env.SOLAPI_API_SECRET || 'Z4YNIAOR6RN5LO6VWNB8NA4LWSSOPHIE';

console.log('=== SOLAPI API 키 테스트 ===');
console.log('API 키:', apiKey);
console.log('API 키 길이:', apiKey.length);
console.log('API 시크릿 길이:', apiSecret.length);

try {
  const messageService = new SolapiMessageService(apiKey, apiSecret);
  console.log('✅ SOLAPI 서비스 인스턴스 생성 완료');
  
  // 간단한 API 호출 테스트 (계정 정보 조회)
  messageService.getBalance()
    .then(balance => {
      console.log('✅ API 키 유효함 - 잔액:', balance);
    })
    .catch(error => {
      console.error('❌ API 키 오류:', error.message);
      if (error.message.includes('Invalid API Key')) {
        console.log('🔍 API 키가 유효하지 않습니다. SOLAPI 대시보드에서 확인하세요.');
      }
    });
} catch (error) {
  console.error('❌ SOLAPI 초기화 실패:', error);
} 