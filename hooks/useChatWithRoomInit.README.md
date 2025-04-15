# useChatWithRoomInit - 채팅 기능 훅

이 훅은 채팅방 ID를 기반으로 메시지를 가져오고, 보내고, 실시간으로 구독하는 기능을 제공합니다.

## 기능

- 채팅 메시지 로딩 및 관리
- 실시간 메시지 구독 (Supabase Realtime)
- 메시지 전송 및 상태 관리
- 메시지 읽음 표시 처리
- 참가자 정보 조회

## 사용 방법

### 1. 기본 사용법

```tsx
import { useChatWithRoomInit } from '@/hooks/useChatWithRoomInit';

function MyChatComponent({ roomId, userId }) {
  const {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    loading,
    error
  } = useChatWithRoomInit(roomId, userId);
  
  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error}</div>;
  
  return (
    <div>
      <div className="messages">
        {messages.map(message => (
          <div key={message.id}>
            {message.content}
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="메시지 입력..."
        />
        <button onClick={sendMessage}>전송</button>
      </div>
    </div>
  );
}
```

### 2. 완성된 채팅 컴포넌트 사용

이 훅을 기반으로 완성된 채팅 컴포넌트를 사용할 수 있습니다:

```tsx
import ChatRoom from '@/components/ChatRoom';

function TransactionPage({ transactionId, userId }) {
  return (
    <div>
      <h1>거래 상세</h1>
      
      {/* 기타 거래 정보 */}
      
      <h2>채팅</h2>
      <ChatRoom roomId="room_123" currentUserId={userId} />
    </div>
  );
}
```

### 3. 주문번호를 이용한 채팅방 초기화 및 사용

주문번호를 이용해 채팅방을 자동으로 초기화하고 채팅 컴포넌트를 렌더링할 수 있습니다:

```tsx
import ChatWithOrderInit from '@/components/ChatWithOrderInit';

function TransactionPage({ orderNumber, userId }) {
  return (
    <div>
      <h1>거래 상세</h1>
      
      {/* 기타 거래 정보 */}
      
      <h2>채팅</h2>
      <ChatWithOrderInit 
        orderNumber={orderNumber} 
        currentUserId={userId} 
      />
    </div>
  );
}
```

## 반환 값

| 이름 | 타입 | 설명 |
|------|------|------|
| messages | ChatMessage[] | 채팅 메시지 목록 |
| participants | ChatParticipant[] | 채팅방 참가자 목록 |
| newMessage | string | 입력 중인 메시지 내용 |
| setNewMessage | (message: string) => void | 메시지 입력 업데이트 함수 |
| sendMessage | () => Promise<void> | 메시지 전송 함수 |
| sendMessageWithEnter | (e: KeyboardEvent) => void | 엔터 키로 메시지 전송 함수 |
| loading | boolean | 로딩 상태 |
| sendingMessage | boolean | 메시지 전송 중 상태 |
| markMessagesAsRead | () => Promise<void> | 메시지 읽음 표시 함수 |
| error | string \| null | 오류 메시지 |
| roomName | string | 채팅방 이름 |

## 구현 및 의존성

- Supabase Realtime을 사용한 실시간 메시지 구독
- React 훅(`useState`, `useEffect`, `useRef`, `useCallback`)
- Supabase 클라이언트 컴포넌트 클라이언트

## 설치 필요 패키지

```bash
npm install @supabase/auth-helpers-nextjs uuid date-fns sonner
# 또는
pnpm add @supabase/auth-helpers-nextjs uuid date-fns sonner
``` 