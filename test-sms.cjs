// 솔라피 SMS 테스트 스크립트
const { SolapiMessageService } = require('solapi');

// 사용자가 제공한 API 정보
const apiKey = "NCSLR9HLUEOHFVAK";
const apiSecret = "Z4YNIAOR6RN5LO6VWNB8NA4LWSSOPHIE";
const senderPhone = "01056183450";

// 메시지 서비스 인스턴스 생성
const messageService = new SolapiMessageService(apiKey, apiSecret);

// 수신자 전화번호를 입력하세요 (테스트를 위해 본인 번호로 변경)
const receiverPhone = "01050424257"; // 실제 테스트 번호

// SMS 발송 함수
async function sendSMS() {
  console.log("📱 SMS 발송 시작...");
  console.log(`📞 수신자: ${receiverPhone}`);
  
  try {
    const response = await messageService.send({
      to: receiverPhone,
      from: senderPhone,
      text: "[이지티켓] 테스트 메시지입니다. 솔라피 API 연동 테스트 중입니다."
    });
    
    console.log("✅ SMS 발송 성공:", response);
    return response;
  } catch (error) {
    console.error("❌ SMS 발송 실패:", error);
    
    // 자세한 오류 정보 출력
    if (error.failedMessageList) {
      console.error("상세 오류:", JSON.stringify(error.failedMessageList, null, 2));
    }
    
    return error;
  }
}

// 스크립트 실행
sendSMS()
  .then(() => console.log("📝 테스트 완료"))
  .catch(err => console.error("⚠️ 오류 발생:", err));

// SMS는 카카오 알림톡과 달리 템플릿 등록이 필요 없어 테스트하기 더 쉽습니다.
// 이 테스트가 성공하면 API 키와 시크릿이 올바르게 설정된 것입니다. 