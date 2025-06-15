-- 피드백 테이블 생성
CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  admin_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 피드백을 삽입할 수 있도록 허용
CREATE POLICY "Anyone can insert feedback" ON feedback
  FOR INSERT WITH CHECK (true);

-- 관리자만 피드백을 조회할 수 있도록 설정 (필요시 수정)
-- CREATE POLICY "Admins can view feedback" ON feedback
--   FOR SELECT USING (auth.role() = 'admin');

-- 현재는 개발 단계이므로 모든 사용자가 조회 가능하도록 설정
CREATE POLICY "Anyone can view feedback" ON feedback
  FOR SELECT USING (true);

-- 업데이트 시간 자동 갱신을 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_feedback_updated_at 
  BEFORE UPDATE ON feedback 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column(); 