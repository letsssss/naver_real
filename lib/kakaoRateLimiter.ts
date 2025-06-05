import { getSupabaseClient } from '@/lib/supabase';

/**
 * 알림톡 발송 타입 정의
 */
type KakaoMessageType = 'NEW_MESSAGE' | 'PURCHASE' | 'TICKET';

/**
 * 특정 전화번호/메시지 타입 조합에 대해 카카오 알림톡을 발송할 수 있는지 확인
 * @param phoneNumber 전화번호
 * @param messageType 메시지 타입
 * @returns 발송 가능 여부와 디버깅 정보
 */
export async function canSendKakao(phoneNumber: string, messageType: KakaoMessageType): Promise<{
  canSend: boolean;
  debugInfo?: {
    currentTime: string;
    tenMinutesAgo: string;
    lastSentTime?: string;
    minutesElapsed?: number;
    recordsFound: number;
  };
}> {
  try {
    // 하이픈 제거된 번호 사용
    const cleanPhone = phoneNumber.replace(/-/g, '');
    
    // 현재 시간 (UTC)
    const now = new Date();
    // 10분 전 시간 계산 (밀리초로 계산하여 더 정확하게)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    
    console.log(`📅 [카카오 제한 체크] ${cleanPhone} (${messageType})`);
    console.log(`📅 현재 시간: ${now.toISOString()}`);
    console.log(`📅 10분 전: ${tenMinutesAgo.toISOString()}`);
    
    // Supabase 클라이언트 가져오기
    const supabase = await getSupabaseClient();
    
    // 최근 로그 조회
    const { data, error } = await supabase
      .from('kakao_send_logs')
      .select('*')
      .eq('phone_number', cleanPhone)
      .eq('message_type', messageType)
      .gt('created_at', tenMinutesAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    console.log(`📊 조회 결과: ${data?.length || 0}개의 최근 로그`);
    
    const debugInfo: {
      currentTime: string;
      tenMinutesAgo: string;
      recordsFound: number;
      lastSentTime?: string;
      minutesElapsed?: number;
    } = {
      currentTime: now.toISOString(),
      tenMinutesAgo: tenMinutesAgo.toISOString(),
      recordsFound: data?.length || 0
    };
    
    if (data && data.length > 0) {
      const lastSentTime = new Date(data[0].created_at);
      const timeDiff = now.getTime() - lastSentTime.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));
      
      debugInfo.lastSentTime = data[0].created_at;
      debugInfo.minutesElapsed = minutesDiff;
      
      console.log(`📊 가장 최근 발송: ${data[0].created_at}`);
      console.log(`📊 경과 시간: ${minutesDiff}분`);
    }
    
    if (error) {
      console.error(`❌ 카카오 로그 조회 오류:`, error);
      // 오류 발생 시 안전하게 false 반환 (발송 제한)
      return { canSend: false };
    }
    
    // 최근 10분 내 발송 기록이 없으면 true, 있으면 false
    const canSend = data.length === 0;
    console.log(`✅ 발송 가능 여부: ${canSend}`);
    
    return { canSend, debugInfo };
  } catch (error) {
    console.error(`❌ 카카오 제한 체크 오류:`, error);
    // 오류 발생 시 안전하게 false 반환 (발송 제한)
    return { canSend: false };
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
    
    console.log(`💾 [카카오 로그 저장] ${cleanPhone} (${messageType})`);
    
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
      console.error(`❌ 카카오 로그 저장 실패:`, error);
    } else {
      console.log(`✅ 카카오 로그 저장 성공`);
    }
  } catch (error) {
    console.error(`❌ 카카오 로그 저장 중 오류:`, error);
  }
} 