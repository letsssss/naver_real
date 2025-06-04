import { getSupabaseClient } from '@/lib/supabase';

/**
 * 알림톡 발송 타입 정의
 */
type KakaoMessageType = 'NEW_MESSAGE' | 'PURCHASE' | 'TICKET';

/**
 * 특정 전화번호/메시지 타입 조합에 대해 카카오 알림톡을 발송할 수 있는지 확인
 * @param phoneNumber 전화번호
 * @param messageType 메시지 타입
 * @returns 발송 가능 여부
 */
export async function canSendKakao(phoneNumber: string, messageType: KakaoMessageType): Promise<boolean> {
  try {
    // 하이픈 제거된 번호 사용
    const cleanPhone = phoneNumber.replace(/-/g, '');
    
    // 1시간 전 시간 계산
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    // Supabase 클라이언트 가져오기
    const supabase = await getSupabaseClient();
    
    // 최근 로그 조회
    const { data, error } = await supabase
      .from('kakao_send_logs')
      .select('*')
      .eq('phone_number', cleanPhone)
      .eq('message_type', messageType)
      .gt('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('❌ 카카오 발송 로그 조회 오류:', error);
      // 오류 발생 시 안전하게 false 반환 (발송 제한)
      return false;
    }
    
    // 최근 1시간 내 발송 기록이 없으면 true, 있으면 false
    return data.length === 0;
  } catch (error) {
    console.error('❌ 카카오 발송 제한 검사 중 오류:', error);
    // 오류 발생 시 안전하게 false 반환 (발송 제한)
    return false;
  }
}

/**
 * 카카오 알림톡 발송 로그 업데이트
 * @param phoneNumber 전화번호
 * @param messageType 메시지 타입
 */
export async function updateKakaoSendLog(phoneNumber: string, messageType: KakaoMessageType): Promise<void> {
  try {
    // 하이픈 제거된 번호 사용
    const cleanPhone = phoneNumber.replace(/-/g, '');
    
    // Supabase 클라이언트 가져오기
    const supabase = await getSupabaseClient();
    
    // 발송 로그 저장
    const { error } = await supabase
      .from('kakao_send_logs')
      .insert({
        phone_number: cleanPhone,
        message_type: messageType,
      });
    
    if (error) {
      console.error('❌ 카카오 발송 로그 저장 오류:', error);
    } else {
      console.log(`✅ 카카오 발송 로그 저장 완료: ${cleanPhone} (${messageType})`);
    }
  } catch (error) {
    console.error('❌ 카카오 발송 로그 업데이트 중 오류:', error);
  }
} 