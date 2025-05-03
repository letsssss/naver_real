-- kakao_send_logs 테이블 생성
CREATE TABLE IF NOT EXISTS public.kakao_send_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- 인덱스 추가 (빠른 조회를 위함)
  CONSTRAINT idx_phone_type UNIQUE (phone_number, message_type, created_at)
);

-- RLS 정책 설정 (Row Level Security)
ALTER TABLE public.kakao_send_logs ENABLE ROW LEVEL SECURITY;

-- 서비스 계정/관리자만 접근 가능하도록 정책 추가
CREATE POLICY "Service accounts can insert kakao_send_logs" ON public.kakao_send_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
  
CREATE POLICY "Service accounts can select kakao_send_logs" ON public.kakao_send_logs
  FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- 주석 추가
COMMENT ON TABLE public.kakao_send_logs IS '카카오 알림톡 발송 제한을 위한 로그';
COMMENT ON COLUMN public.kakao_send_logs.phone_number IS '수신자 전화번호';
COMMENT ON COLUMN public.kakao_send_logs.message_type IS '메시지 유형 (NEW_MESSAGE, PURCHASE, TICKET 등)';
COMMENT ON COLUMN public.kakao_send_logs.created_at IS '발송 일시'; 