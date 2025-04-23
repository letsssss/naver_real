import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function main() {
  try {
    console.log('기존 구매 정보로 채팅방 생성 시작...');
    
    // 기존 구매 정보 조회
    const purchases = await supabase
      .from('purchases')
      .select('*')
      .eq('buyerId', supabase.auth.user().id);
    
    console.log(`총 ${purchases.length}개의 구매 정보를 찾았습니다.`);
    
    // 각 구매에 대해 채팅방 생성
    let roomCount = 0;
    for (const purchase of purchases) {
      try {
        // 이미 채팅방이 있는지 확인
        const existingRoom = await supabase
          .from('rooms')
          .select('*')
          .eq('purchaseId', purchase.id);
        
        if (existingRoom.length > 0) {
          console.log(`구매 ID ${purchase.id}에 대한 채팅방이 이미 존재합니다.`);
          continue;
        }
        
        // 채팅방 이름 생성 (고유한 채팅방 식별자)
        const roomName = `purchase_${purchase.id}`;
        
        // 채팅방 생성
        const room = await supabase
          .from('rooms')
          .insert([
            {
              name: roomName,
              purchaseId: purchase.id,
              participants: [
                { userId: purchase.buyerId },
                { userId: purchase.sellerId }
              ]
            }
          ])
          .select('*');
        
        // 기존 메시지가 있으면 연결 (별도로 처리)
        const messages = await supabase
          .from('messages')
          .select('*')
          .eq('purchaseId', purchase.id);
        
        if (messages.length > 0) {
          await supabase
            .from('messages')
            .update({ roomId: room[0].id })
            .eq('purchaseId', purchase.id);
          console.log(`${messages.length}개의 기존 메시지를 채팅방에 연결했습니다.`);
        }
        
        console.log(`구매 ID ${purchase.id}에 대한 채팅방 ${roomName}이 생성되었습니다.`);
        roomCount++;
      } catch (err) {
        console.error(`구매 ID ${purchase.id}에 대한 채팅방 생성 중 오류 발생:`, err);
      }
    }
    
    console.log(`총 ${roomCount}개의 채팅방이 성공적으로 생성되었습니다.`);
  } catch (error) {
    console.error('채팅방 생성 중 오류 발생:', error);
  }
}

// 스크립트 실행
main()
  .then(() => console.log('채팅방 초기화 완료'))
  .catch(e => console.error(e)); 