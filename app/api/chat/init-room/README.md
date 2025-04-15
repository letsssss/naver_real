# 채팅방 초기화 API

이 API는 주문번호(order_number)를 기반으로 채팅방을 자동으로 생성하거나 기존 채팅방을 반환합니다.

## API 엔드포인트

```
POST /api/chat/init-room
```

## 요청 형식

```json
{
  "order_number": "ORDER-1234-5678"
}
```

## 응답 형식

### 성공 (기존 채팅방 존재)

```json
{
  "room_id": 123,
  "room_name": "purchase_456",
  "message": "기존 채팅방이 사용됩니다."
}
```

### 성공 (새 채팅방 생성)

```json
{
  "room_id": 123,
  "room_name": "purchase_456",
  "message": "새 채팅방이 생성되었습니다."
}
```

### 오류

```json
{
  "error": "오류 메시지",
  "details": "상세 오류 정보 (개발 환경에서만 제공)"
}
```

## 클라이언트 사용 예시

```typescript
/**
 * 주문번호로 채팅방을 초기화하고 room_id를 반환받는 함수
 * @param orderNumber 주문 번호
 * @returns 채팅방 ID
 */
async function initChatRoom(orderNumber: string) {
  try {
    const response = await fetch('/api/chat/init-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_number: orderNumber }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '채팅방 초기화 중 오류가 발생했습니다.');
    }
    
    const { room_id, room_name } = await response.json();
    console.log(`채팅방이 준비되었습니다: ${room_name} (ID: ${room_id})`);
    
    return room_id;
  } catch (error) {
    console.error('채팅방 초기화 실패:', error);
    throw error;
  }
}

/**
 * useChatWithRoomInit 훅 사용 예시 (향후 구현 예정)
 */
function ChatComponent({ orderNumber }) {
  const [roomId, setRoomId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function setupChat() {
      try {
        setIsLoading(true);
        const roomId = await initChatRoom(orderNumber);
        setRoomId(roomId);
      } catch (error) {
        console.error('채팅방 설정 오류:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (orderNumber) {
      setupChat();
    }
  }, [orderNumber]);
  
  if (isLoading) {
    return <div>채팅방을 준비 중입니다...</div>;
  }
  
  if (!roomId) {
    return <div>채팅방을 불러올 수 없습니다.</div>;
  }
  
  return (
    <div>
      {/* 여기서 실제 채팅 컴포넌트를 렌더링 */}
      <ChatWithRoom roomId={roomId} />
    </div>
  );
}
```

## 권한 및 보안

- 인증된 사용자만 API를 호출할 수 있습니다.
- 해당 거래의 구매자 또는 판매자만 채팅방에 접근할 수 있습니다.
- 관리자 권한 클라이언트를 사용하여 보안 정책을 우회합니다.

## 다음 단계

1. `useChatWithRoomInit` 훅 구현
2. 실시간 메시지 구독 설정
3. 메시지 전송 기능 구현 