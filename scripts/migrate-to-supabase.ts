import { PrismaClient } from '@prisma/client';
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
const prisma = new PrismaClient();
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

async function migrateUsers() {
  log('사용자 마이그레이션 시작...');
  const users = await prisma.user.findMany();
  migrationStats.users.total = users.length;

  // 배치 처리를 위해 사용자 분할
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    log(`사용자 배치 처리 중: ${i + 1} ~ ${Math.min(i + BATCH_SIZE, users.length)} / ${users.length}`);
    
    const promises = batch.map(async (user) => {
      try {
        // 1. Supabase Auth에 사용자 존재 여부 확인
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        
        // 이메일로 사용자 필터링
        const matchingUsers = existingUsers?.users?.filter(u => u.email === user.email) || [];
        
        let authUserId;
        
        if (matchingUsers.length > 0) {
          log(`사용자 ${user.email} (ID: ${user.id})는 이미 Supabase Auth에 존재합니다.`);
          authUserId = matchingUsers[0].id;
        } else {
          // 2. 새 사용자 생성
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: 'TemporaryPassword123!', // 임시 비밀번호 설정 (후에 변경 요청)
            email_confirm: true, // 이메일 확인됨으로 설정
            user_metadata: {
              name: user.name,
              role: user.role,
            },
          });

          if (authError) {
            throw new Error(`사용자 ${user.email} Auth 마이그레이션 실패: ${authError.message}`);
          }
          
          authUserId = authUser.user?.id;
          log(`사용자 ${user.email} (ID: ${user.id}) Auth 마이그레이션 성공`);
        }

        // 3. Supabase 데이터베이스에 추가 사용자 정보 저장 (upsert)
        const { error: dbError } = await supabase
          .from('User')
          .upsert({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            profile_image: user.profileImage,
            phone_number: user.phoneNumber,
            created_at: user.createdAt,
            updated_at: user.updatedAt,
            bank_info: user.bankInfo,
            auth_id: authUserId,
          }, { onConflict: 'id' });

        if (dbError) {
          throw new Error(`사용자 ${user.email} 추가 정보 저장 실패: ${dbError.message}`);
        }

        log(`사용자 ${user.email} (ID: ${user.id}) 마이그레이션 완료`);
        migrationStats.users.success++;
        return true;
      } catch (error) {
        log(`사용자 마이그레이션 오류 (ID: ${user.id}): ${error instanceof Error ? error.message : String(error)}`);
        migrationStats.users.failed++;
        return false;
      }
    });
    
    await Promise.all(promises);
  }

  log(`사용자 마이그레이션 완료: 총 ${migrationStats.users.total}명 중 ${migrationStats.users.success}명 성공, ${migrationStats.users.failed}명 실패`);
}

async function migratePosts() {
  log('게시글 마이그레이션 시작...');
  const posts = await prisma.post.findMany();
  migrationStats.posts.total = posts.length;

  // 배치 처리를 위해 게시글 분할
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    log(`게시글 배치 처리 중: ${i + 1} ~ ${Math.min(i + BATCH_SIZE, posts.length)} / ${posts.length}`);
    
    const promises = batch.map(async (post) => {
      try {
        const { error } = await supabase
          .from('Post')
          .upsert({
            id: post.id.toString(), // BigInt를 문자열로 변환
            title: post.title,
            content: post.content,
            category: post.category,
            created_at: post.createdAt,
            updated_at: post.updatedAt,
            user_id: post.authorId,
            is_deleted: post.isDeleted,
            view_count: post.viewCount,
            event_name: post.eventName,
            event_date: post.eventDate,
            event_venue: post.eventVenue,
            ticket_price: post.ticketPrice ? post.ticketPrice.toString() : null,
            contact_info: post.contactInfo,
            status: post.status,
          }, { onConflict: 'id' });

        if (error) {
          throw new Error(`게시글 저장 오류: ${error.message}`);
        }

        log(`게시글 ID ${post.id} 마이그레이션 완료`);
        migrationStats.posts.success++;
        return true;
      } catch (error) {
        log(`게시글 마이그레이션 오류 (ID: ${post.id}): ${error instanceof Error ? error.message : String(error)}`);
        migrationStats.posts.failed++;
        return false;
      }
    });
    
    await Promise.all(promises);
  }

  log(`게시글 마이그레이션 완료: 총 ${migrationStats.posts.total}개 중 ${migrationStats.posts.success}개 성공, ${migrationStats.posts.failed}개 실패`);
}

async function migrateNotifications() {
  log('알림 마이그레이션 시작...');
  const notifications = await prisma.notification.findMany();
  migrationStats.notifications.total = notifications.length;

  // 배치 처리를 위해 알림 분할
  for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
    const batch = notifications.slice(i, i + BATCH_SIZE);
    log(`알림 배치 처리 중: ${i + 1} ~ ${Math.min(i + BATCH_SIZE, notifications.length)} / ${notifications.length}`);
    
    const promises = batch.map(async (notification) => {
      try {
        const { error } = await supabase
          .from('Notification')
          .upsert({
            id: notification.id.toString(), // ID를 문자열로 변환
            user_id: notification.userId.toString(), // userId를 user_id로 변경
            post_id: notification.postId ? notification.postId.toString() : null, // postId를 post_id로 변경
            message: notification.message,
            type: notification.type,
            is_read: notification.isRead, // isRead를 is_read로 변경
            created_at: notification.createdAt, // createdAt을 created_at으로 변경
            // updatedAt이 없는 경우 createdAt 사용
            updated_at: notification.createdAt
          }, { onConflict: 'id' });

        if (error) {
          throw new Error(`알림 저장 오류: ${error.message}`);
        }

        log(`알림 ID ${notification.id} 마이그레이션 완료`);
        migrationStats.notifications.success++;
        return true;
      } catch (error) {
        log(`알림 마이그레이션 오류 (ID: ${notification.id}): ${error instanceof Error ? error.message : String(error)}`);
        migrationStats.notifications.failed++;
        return false;
      }
    });
    
    await Promise.all(promises);
  }

  log(`알림 마이그레이션 완료: 총 ${migrationStats.notifications.total}개 중 ${migrationStats.notifications.success}개 성공, ${migrationStats.notifications.failed}개 실패`);
}

async function migratePurchases() {
  log('구매 정보 마이그레이션 시작...');
  const purchases = await prisma.purchase.findMany();
  migrationStats.purchases.total = purchases.length;

  // 배치 처리를 위해 구매 정보 분할
  for (let i = 0; i < purchases.length; i += BATCH_SIZE) {
    const batch = purchases.slice(i, i + BATCH_SIZE);
    log(`구매 정보 배치 처리 중: ${i + 1} ~ ${Math.min(i + BATCH_SIZE, purchases.length)} / ${purchases.length}`);
    
    const promises = batch.map(async (purchase) => {
      try {
        // 구매 스키마를 확인하고 필드를 매핑합니다
        const { error } = await supabase
          .from('Purchase')
          .upsert({
            id: purchase.id.toString(),
            // 실제 Purchase 모델의 필드에 맞게 매핑
            user_id: purchase.buyerId ? purchase.buyerId.toString() : null,  // buyerId를 user_id로 변경
            post_id: purchase.postId ? purchase.postId.toString() : null,
            price: purchase.totalPrice ? purchase.totalPrice.toString() : '0',  // totalPrice를 price로 변경
            status: purchase.status,
            payment_method: purchase.paymentMethod,
            created_at: purchase.createdAt,
            updated_at: purchase.updatedAt
          }, { onConflict: 'id' });

        if (error) {
          throw new Error(`구매 정보 저장 오류: ${error.message}`);
        }

        log(`구매 정보 ID ${purchase.id} 마이그레이션 완료`);
        migrationStats.purchases.success++;
        return true;
      } catch (error) {
        log(`구매 정보 마이그레이션 오류 (ID: ${purchase.id}): ${error instanceof Error ? error.message : String(error)}`);
        migrationStats.purchases.failed++;
        return false;
      }
    });
    
    await Promise.all(promises);
  }

  log(`구매 정보 마이그레이션 완료: 총 ${migrationStats.purchases.total}개 중 ${migrationStats.purchases.success}개 성공, ${migrationStats.purchases.failed}개 실패`);
}

async function migrateAll() {
  const startTime = Date.now();
  log('전체 데이터 마이그레이션 시작...');
  
  try {
    // 먼저 사용자를 마이그레이션
    await migrateUsers();
    
    // 그 다음 게시글 마이그레이션
    await migratePosts();
    
    // 알림 마이그레이션
    await migrateNotifications();
    
    // 구매 정보 마이그레이션
    await migratePurchases();
    
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
  } finally {
    await prisma.$disconnect();
  }
}

// 마이그레이션 실행
migrateAll(); 