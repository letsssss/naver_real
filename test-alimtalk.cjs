// 솔라피 알림톡 테스트 스크립트
const { SolapiMessageService } = require('solapi');

// 사용자가 제공한 API 정보
const apiKey = "NCSLR9HLUEOHFVAK";
const apiSecret = "Z4YNIAOR6RN5LO6VWNB8NA4LWSSOPHIE";
const pfId = "KA01PF2504270350090645hp8rQ1lvqL";
const senderPhone = "01056183450";

// 메시지 서비스 인스턴스 생성
const messageService = new SolapiMessageService(apiKey, apiSecret);

// 수신자 전화번호를 입력하세요 (테스트를 위해 본인 번호로 변경)
const receiverPhone = "01050424257"; // 실제 테스트 번호

// 수정된 정확한 템플릿 ID
const templateId = "KA01TP230126085130773ZHclHN4i674"; // 새 메시지 알림 템플릿 (정확한 ID)

// 알림톡 발송 함수
async function sendAlimtalk() {
  console.log("📱 알림톡 발송 시작...");
  console.log(`📞 수신자: ${receiverPhone}`);
  console.log(`🆔 템플릿 ID: ${templateId}`);
  
  try {
    const response = await messageService.send({
      to: receiverPhone,
      from: senderPhone,
      kakaoOptions: {
        pfId: pfId,
        templateId: templateId,
        variables: {
          // 템플릿 변수에 맞게 수정
          "#{이름}": "테스트사용자"
        }
      }
    });
    
    console.log("✅ 알림톡 발송 성공:", response);
    return response;
  } catch (error) {
    console.error("❌ 알림톡 발송 실패:", error);
    
    // 자세한 오류 정보 출력
    if (error.failedMessageList) {
      console.error("상세 오류:", JSON.stringify(error.failedMessageList, null, 2));
    }
    
    return error;
  }
}

// 스크립트 실행
sendAlimtalk()
  .then(() => console.log("📝 테스트 완료"))
  .catch(err => console.error("⚠️ 오류 발생:", err));

// 참고: 만약 여전히 오류가 발생한다면, 솔라피 대시보드에서 템플릿 ID를 직접 확인하세요.
// https://solapi.com/에 로그인하여 '알림톡' > '템플릿 관리'에서 확인하세요. 