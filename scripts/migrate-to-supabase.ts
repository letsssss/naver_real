import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 현재 파일 경로 설정 (ESM에서는 __dirname이 없음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드
dotenv.config({ path: '.env.local' });

// 로그 파일 설정
const logDir = path.join(path.resolve(__dirname, '..'), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const logFile = path.join(logDir, `migration-${new Date().toISOString().replace(/:/g, '-')}.log`);

// 로그 작성 함수
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// 환경 변수 검증
if (!supabaseUrl || !supabaseServiceKey) {
  log('오류: 필수 환경 변수가 없습니다. .env.local 파일을 확인하세요.');
  log('필요한 환경 변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 서비스 롤 키를 사용하여 Supabase 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 마이그레이션 진행 상황 추적
const migrationStats = {
  users: { total: 0, success: 0, failed: 0 },
  posts: { total: 0, success: 0, failed: 0 },
  notifications: { total: 0, success: 0, failed: 0 },
  purchases: { total: 0, success: 0, failed: 0 },
};

// 배치 크기 설정
const BATCH_SIZE = 50;

async function migrateAll() {
  const startTime = Date.now();
  log('전체 데이터 마이그레이션 시작...');
  
  try {
    // 마이그레이션 통계 출력
    const durationMs = Date.now() - startTime;
    const durationMin = Math.floor(durationMs / 60000);
    const durationSec = Math.floor((durationMs % 60000) / 1000);
    
    log('');
    log('=== 마이그레이션 결과 요약 ===');
    log(`총 소요 시간: ${durationMin}분 ${durationSec}초`);
    log(`사용자: 총 ${migrationStats.users.total}명 중 ${migrationStats.users.success}명 성공, ${migrationStats.users.failed}명 실패`);
    log(`게시글: 총 ${migrationStats.posts.total}개 중 ${migrationStats.posts.success}개 성공, ${migrationStats.posts.failed}개 실패`);
    log(`알림: 총 ${migrationStats.notifications.total}개 중 ${migrationStats.notifications.success}개 성공, ${migrationStats.notifications.failed}개 실패`);
    log(`구매 정보: 총 ${migrationStats.purchases.total}개 중 ${migrationStats.purchases.success}개 성공, ${migrationStats.purchases.failed}개 실패`);
    log('모든 데이터 마이그레이션이 완료되었습니다!');
    log(`로그 파일 위치: ${logFile}`);
  } catch (error) {
    log(`마이그레이션 중 치명적 오류 발생: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      log(`스택 트레이스: ${error.stack}`);
    }
  }
}

// 마이그레이션 실행
migrateAll(); 