# 카카오페이 결제 연동 가이드 (PortOne V2)

Ficket 프로젝트에서 얼굴 인식 기반 티켓팅 중, 티켓 구매를 구현하는 과정에서 PortOne(KakaoPay)을 사용하였습니다. 본 문서는 포트원 API V2, 웹훅 V2 버전(2024-04-25 기준), 테스트 기반으로 작성되었습니다.

## 1. 포트원 연동 (KakaoPay)

### 1-1. 채널 추가
포트원에서 결제를 사용하려면 먼저 채널을 추가해야 합니다.

포트원 대시보드에서 채널을 추가합니다.
채널 추가 후, STORE_ID, CHANNEL_KEY는 추후 사용할 예정입니다.

### 1-2. API V2 및 웹훅 키 발급
**API V2 발급**
포트원에서 제공하는 API V2 키를 발급받아 설정합니다.

**웹훅 키 발급**
Endpoint URL에 localhost는 사용할 수 없으므로 ngrok을 사용해 발급받은 URL을 입력합니다. (반드시 /valid일 필요는 없습니다.)

## 2. 결제창 호출하기 (React + TypeScript)

### 2.1 라이브러리 설치
포트원의 JavaScript brower-sdk를 설치합니다.
포트원 V2 SDK는 타입스크립트 선언 파일(.d.ts)의 형식으로 타입 정보를 제공하고 있습니다.

```bash
npm i @portone/browser-sdk
```

### 2.2 환경 변수 설정
환경 변수에 상점 ID와 채널 키를 추가합니다.

```
VITE_STORE_ID={STORE_ID}
VITE_CHANNEL_KEY={CHANNEL_KEY}
```

### 2.3 결제창 호출
웹훅에서 설정한 URL을 noticeUrls로 지정합니다.

```tsx
import PortOne from '@portone/browser-sdk/v2';
import { useState } from 'react';

const STORE_ID = import.meta.env.VITE_STORE_ID;
const CHANNEL_KEY = import.meta.env.VITE_CHANNEL_KEY;

const KakaoPay = () => {
  const [isWaitingPayment, setWaitingPayment] = useState(false);
  const totalAmount = 710000;
  const customMessage = 'VIP 1열 1번, VIP 3열 12번';

  const randomId = () => {
    return Array.from(crypto.getRandomValues(new Uint32Array(2)))
      .map((word) => word.toString(16).padStart(8, '0'))
      .join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitingPayment(true);

    const paymentId = randomId();
    try {
      // SSE 연결 (선택)
      
      await PortOne.requestPayment({
        storeId: STORE_ID,
        paymentId,
        orderName: '공연명 - 날짜 시간 (장소)',
        totalAmount,
        currency: 'CURRENCY_KRW',
        channelKey: CHANNEL_KEY,
        payMethod: 'EASY_PAY',
        easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
        bypass: { kakaopay: { custom_message: customMessage } },
        noticeUrls: ['https://example.com/api/v1/ticketing/order/notice'],
      });
    } catch (error) {
      console.error('결제 요청 중 오류 발생:', error);
    } finally {
      setWaitingPayment(false);
    }
  };

  return (
    <button onClick={handleSubmit} disabled={isWaitingPayment}>
      {isWaitingPayment ? '결제 진행 중...' : `${totalAmount} 원 결제하기`}
    </button>
  );
};

export default KakaoPay;
```

## 3. 웹훅 받기
포트원에서는 다양한 언어의 서버 SDK를 제공하지만, Spring을 직접 지원하는 SDK는 제공되지 않습니다.
그러나 포트원이 제공하는 코드를 활용하면, Spring 환경에서도 직접 구현하여 연동할 수 있습니다.

### 3.1 환경 변수 설정
WebHook V2 Secret을 Spring 프로젝트의 환경 변수에 추가합니다.

```yaml
portone:
  webhook:
    secret: "{WEBHOOK_V2_SECRET}"
```

### 3.2 Controller 구현
웹훅 요청을 처리하는 컨트롤러입니다. 요청 헤더는 필수로 포함되어야 하며, webhook-id, webhook-signature, webhook-timestamp는 요청의 유효성을 검증하기 위해 반드시 필요합니다.

```java
@RestController
@RequestMapping("/api/v1/ticketing/order")
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/valid")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("webhook-id") String webhookId,
            @RequestHeader("webhook-signature") String webhookSignature,
            @RequestHeader("webhook-timestamp") String webhookTimestamp
    ) {
        orderService.processWebhook(webhookId, webhookSignature, webhookTimestamp, payload);
        return ResponseEntity.ok("Webhook processed");
    }
}
```

### 3.3 Service 구현
OrderService는 포트원의 Server-SDK를 참고하여 작성되었으며, 주요 기능은 웹훅 요청의 시그니처 검증과 이벤트 처리입니다.

**시그니처 검증의 핵심 단계:**
- 타임스탬프 유효성 검증: 요청이 5분 이상 지났거나 5분 이상 미래인 경우라면 유효하지 않은 것으로 간주합니다.
- 시그니처 생성 및 비교: 포트원에서 제공한 Webhook V2 Secret 키를 사용하여 시그니처를 생성하고 비교합니다.

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    @Value("${portone.webhook.secret}")
    private String WEBHOOK_SECRET;
    
    private final OrderRepository orderRepository;

    /**
     * 웹훅 처리 메인 메소드
     */
    public void processWebhook(String webhookId, String webhookSignature, String webhookTimestamp, String payload) {
        verifyTimestamp(webhookTimestamp); // 타임스탬프 검증
        String expectedSignature = generateSignature(webhookId, webhookTimestamp, payload); // 시그니처 생성
        if (!verifySignature(expectedSignature, webhookSignature)) { // 시그니처 비교
            throw new IllegalArgumentException("유효하지 않은 시그니처");
        }
        WebhookPayload data = parsePayload(payload); // 요청 본문 파싱
        handleEvent(data); // 이벤트 처리
    }

    /**
     * 타임스탬프 검증
     * 요청이 5분 이상 경과한 경우 무효화
     */
    private void verifyTimestamp(String timestamp) {
        long now = System.currentTimeMillis() / 1000; // 현재 시간 (초 단위)
        long requestTimestamp = Long.parseLong(timestamp); // 요청 시간
        if (Math.abs(now - requestTimestamp) > 300) { // 5분 = 300초
            throw new IllegalArgumentException("유효하지 않은 타임스탬프");
        }
    }

    /**
     * 요청 데이터 기반 시그니처 생성
     */
    private String generateSignature(String webhookId, String timestamp, String payload) {
        try {
            String dataToSign = String.join(".", webhookId, timestamp, payload); // 데이터 조합
            Mac mac = Mac.getInstance("HmacSHA256"); // HMAC-SHA256 알고리즘 사용
            mac.init(new SecretKeySpec(WEBHOOK_SECRET.getBytes(), "HmacSHA256")); // Secret 키 설정
            return Base64.getEncoder().encodeToString(mac.doFinal(dataToSign.getBytes())); // 시그니처 생성
        } catch (Exception e) {
            throw new RuntimeException("시그니처 생성 중 오류 발생", e);
        }
    }

    /**
     * 시그니처 비교
     * 생성된 시그니처와 포트원에서 제공된 시그니처가 동일한지 확인
     */
    private boolean verifySignature(String expectedSignature, String actualSignature) {
        return expectedSignature.equals(actualSignature);
    }

    /**
     * 웹훅 데이터 JSON 파싱
     */
    private WebhookPayload parsePayload(String payload) {
        try {
            return new ObjectMapper().readValue(payload, WebhookPayload.class); // Jackson 사용
        } catch (JsonProcessingException e) {
            throw new RuntimeException("JSON 파싱 오류", e);
        }
    }

    /**
     * 이벤트 유형에 따른 처리
     */
    private void handleEvent(WebhookPayload data) {
        String type = data.getType(); // 이벤트 타입
        String paymentId = data.getData().getPaymentId(); // 결제 ID

        switch (type) {
            case "Transaction.Ready":
                log.info("결제창 오픈 이벤트 처리");
                break;
            case "Transaction.Paid":
                log.info("결제 완료 이벤트 처리");
                // TODO: 결제 금액 검증 & OrderStatus 변경 & SSE 전송
                break;
            case "Transaction.Cancelled":
                log.info("결제 취소 이벤트 처리");
                break;
            default:
                log.warn("알 수 없는 이벤트 타입: {}", type);
        }
    }
}
```

## 4. 결제 검증
포트원의 단건 조회 API를 사용하여 결제 데이터를 검증합니다.

### 4.1 의존성 추가
Spring WebClient를 사용하려면 아래와 같은 의존성을 추가해야합니다.

```gradle
implementation 'org.springframework.boot:spring-boot-starter-webflux'
```

### 4.2. WebClient 설정
WebClient를 이용해 단건 조회 및 취소 API를 호출하기 위한 클래스를 작성합니다.

```java
@Component
@RequiredArgsConstructor
public class PortOneApiClient {

    private final WebClient webClient;

    @Value("${portone.api.base-url}")
    private String baseUrl;

    @Value("${portone.api.token}")
    private String apiToken;

    /**
     * 단건 조회 API 호출
     * 
     * @param paymentId 결제 ID
     * @return 결제 상세 정보 (Map 형태)
     */
    public Map<String, Object> getPaymentDetails(String paymentId) {
        return webClient
                .get()
                .uri(baseUrl + "/{paymentId}", paymentId)
                .header("Authorization", "PortOne " + apiToken)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    /**
     * 결제 취소 API 호출
     * 
     * @param paymentId 결제 ID
     */
    public CancellationResponse cancelOrder(String paymentId) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("reason", "고객 요청");

        CancellationResponse result = webClient
                .post()
                .uri(baseUrl + "/{paymentId}/cancel", paymentId)
                .header("Authorization", "PortOne " + apiToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(CancellationResponse.class)
                .block();
                
        return result;
    }
}
```

### 4.3. 결제 검증 후 구매 완료 처리
OrderService의 handleEvent 메소드 내에서 결제 검증 로직을 구현합니다:

```java
private boolean verifyPaidInfo(String paymentId) {
    // 포트원 API 호출로 결제 상세 정보 가져오기
    Map<String, Object> paymentDetails = portOneApiClient.getPaymentDetails(paymentId);

    // 포트원에서 전달된 결제 상태 확인
    String status = (String) paymentDetails.get("status");

    // 포트원에서 전달된 결제 금액 확인
    BigDecimal totalPrice = new BigDecimal((Integer) paymentDetails.get("amount"));

    // 데이터베이스에서 주문 금액 조회
    BigDecimal orderPrice = orderRepository.findOrderByPaymentId(paymentId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ORDER_PRICE));

    // 상태와 금액이 모두 유효한 경우 true 반환
    return ("PAID".equalsIgnoreCase(status) && orderPrice.compareTo(totalPrice) == 0);
}

private void handleEvent(WebhookPayload data) {
    String type = data.getType(); // 이벤트 타입
    String paymentId = data.getData().getPaymentId(); // 결제 ID

    switch (type) {
        case "Transaction.Ready":
            log.info("결제창 오픈");
            break;
        case "Transaction.Paid":
            if (verifyPaidInfo(paymentId)) { // 결제 데이터 검증
                orderRepository.updateOrderStatusToCompleted(paymentId); // 구매 완료 처리
                notifyClient(paymentId, "PAID"); // 클라이언트 알림
            } else {
                portOneApiClient.cancelOrder(paymentId); // 결제 취소 처리
            }
            break;
        case "Transaction.Cancelled":
            log.info("결제 취소 처리");
            break;
        default:
            log.warn("알 수 없는 이벤트 타입: {}", type);
    }
}
```

## 로직 흐름 요약

1. **결제 요청 (클라이언트)**
   - 클라이언트에서 PortOne 브라우저 SDK를 사용해 결제를 요청합니다.
   - 결제 요청 시 paymentId, 금액, 결제 방식(EASY_PAY 등)과 같은 데이터를 포함합니다.
   - noticeUrls를 통해 서버의 웹훅 엔드포인트를 등록하여 결제 완료 또는 취소 이벤트를 수신합니다.

2. **웹훅 요청 수신 (서버)**
   - 결제 완료 또는 취소 이벤트가 발생하면, 포트원이 등록된 웹훅 URL로 요청을 전송합니다.
   - 서버는 요청 헤더의 webhook-id, webhook-signature, webhook-timestamp와 본문 데이터를 수신합니다.

3. **웹훅 요청 검증 (시그니처 검증)**
   - webhook-timestamp를 확인해 요청이 유효한 시간 내에 발생했는지 검증합니다.
   - webhook-id, webhook-timestamp, 본문 데이터를 조합해 생성된 시그니처를 헤더의 webhook-signature와 비교하여 요청의 무결성을 확인합니다.
   - 검증 실패 시 요청은 무효화됩니다.

4. **이벤트 처리**
   - 요청 본문 데이터를 파싱해 이벤트 타입(Transaction.Paid, Transaction.Cancelled, Transaction.Ready 등)을 식별합니다.
   - 각 이벤트에 따라 적절한 후속 작업을 수행합니다:
     - Transaction.Paid:
       - 포트원의 단건 조회 API를 호출하여 결제 상태와 금액을 검증합니다.
       - 검증 성공 시 결제를 완료 처리(COMPLETED)하고 클라이언트에 결제 성공 알림을 전송합니다.
       - 검증 실패 시 결제를 취소합니다.
     - Transaction.Cancelled:
       - 결제를 취소 처리(CANCELLED)하고 관련 상태를 업데이트합니다.
     - Transaction.Ready:
       - 결제창 오픈 이벤트로, 로그를 남기고 추가 작업은 수행하지 않습니다.

5. **포트원 API와의 통신**
   - 단건 조회 API(getPaymentDetails)를 호출해 결제 상태(status)와 금액(amount) 정보를 검증합니다.
   - 결제 검증 실패 시 결제 취소 API(cancelOrder)를 호출해 결제를 취소합니다.

6. **상태 업데이트 및 알림**
   - 성공적으로 처리된 결제는 상태를 데이터베이스에 업데이트(COMPLETED 또는 CANCELLED)하고, 클라이언트에 SSE 또는 다른 방식으로 알림을 전송합니다. 