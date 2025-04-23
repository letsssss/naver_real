import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * 이 스크립트는 기존 Purchase 레코드에 관련 Post 데이터를 복사합니다.
 * 현재 Purchase 레코드에 ticketTitle, eventDate 등의 필드가 비어있는 경우
 * 관련 Post에서 해당 정보를 가져와 업데이트합니다.
 */
async function migratePurchaseData() {
  console.log('Purchase 데이터 마이그레이션 시작...');
  
  try {
    // 모든 Purchase 레코드 조회
    const purchases = await supabase
      .from('purchase')
      .select('*')
      .eq('postId', null)
      .eq('ticketTitle', null);
    
    console.log(`마이그레이션이 필요한 Purchase 레코드 수: ${purchases.length}`);
    
    // 각 Purchase 레코드 업데이트
    for (const purchase of purchases) {
      if (purchase.post) {
        // Post 정보가 있는 경우에만 업데이트
        await supabase
          .from('purchase')
          .update({
            ticketTitle: purchase.post.title,
            eventDate: purchase.post.eventDate,
            eventVenue: purchase.post.eventVenue,
            ticketPrice: purchase.post.ticketPrice,
            // 추가 필드도 필요에 따라 업데이트
          })
          .eq('id', purchase.id);
        
        console.log(`Purchase ID ${purchase.id} 업데이트 완료: ${purchase.post.title}`);
      } else {
        console.log(`Purchase ID ${purchase.id}의 Post 정보 없음, 건너뜁니다.`);
      }
    }
    
    console.log('Purchase 데이터 마이그레이션 완료!');
  } catch (error) {
    console.error('마이그레이션 중 오류 발생:', error);
  }
}

// 스크립트 실행
migratePurchaseData(); 