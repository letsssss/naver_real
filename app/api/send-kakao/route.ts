import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// 환경 변수에서 가져오기
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY!;
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET!;
const SOLAPI_SENDER_KEY = process.env.SOLAPI_SENDER_KEY!;
const SOLAPI_TEMPLATE_CODE = process.env.SOLAPI_TEMPLATE_CODE || 'your_template_code';

// Supabase 클라이언트 생성
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 사용자 전화번호 조회 함수
async function getUserPhoneById(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')  // users 테이블에서 조회
      .select('phone_number')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data?.phone_number || null;
  } catch (err) {
    console.error('전화번호 조회 실패:', err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { receiver_id, content, sender_id, message_id } = body;

    // 유저의 전화번호 가져오기
    const phone = await getUserPhoneById(receiver_id);
    
    if (!phone) {
      return NextResponse.json(
        { error: '수신자 전화번호를 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 발신자 정보 가져오기 (옵션)
    const { data: senderData } = await supabase
      .from('users')  // users 테이블에서 조회
      .select('name')
      .eq('id', sender_id)
      .single();
    
    const senderName = senderData?.name || '알 수 없음';

    // 카카오 알림톡 전송
    await axios.post(
      'https://api.solapi.com/messages/v4/send',
      {
        message_type: 'ATA',
        country: '82',
        from: process.env.SENDER_PHONE || '발신번호',
        to: phone,
        subject: '새 메시지 알림',
        content: `${senderName}님이 메시지를 보냈습니다: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`,
        kakaoOptions: {
          pfId: SOLAPI_SENDER_KEY,
          templateId: SOLAPI_TEMPLATE_CODE,
        },
      },
      {
        auth: {
          username: SOLAPI_API_KEY,
          password: SOLAPI_API_SECRET,
        },
      }
    );

    // 알림 발송 로그 기록 (선택사항)
    await supabase.from('notification_logs').insert({
      user_id: receiver_id,
      message_id,
      notification_type: 'kakao',
      status: 'sent',
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('알림톡 전송 실패:', error);
    return NextResponse.json(
      { error: '알림 전송 실패' },
      { status: 500 }
    );
  }
} 