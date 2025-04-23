// Supabase 마이그레이션 실행 스크립트
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 로그 디렉토리 생성
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  console.log('로그 디렉토리를 생성합니다...');
  fs.mkdirSync(logDir);
  console.log('로그 디렉토리가 생성되었습니다.');
} else {
  console.log('로그 디렉토리가 이미 존재합니다.');
}

// 환경 변수 설정
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jdubrjczdyqqtsppojgu.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbB';

console.log('Supabase 환경 변수가 설정되었습니다.');
console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log('Anon Key: 설정됨 (보안상 표시되지 않음)');

// 마이그레이션 스크립트 실행
console.log('마이그레이션 스크립트를 실행합니다...');

// 로그 파일 설정
const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
const logFile = path.join(logDir, `run_migration_${timestamp}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  console.log(message);
  logStream.write(message + '\n');
}

// 마이그레이션 스크립트 생성
const migrateDataContent = `
// Supabase 데이터 마이그레이션 스크립트
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 로깅 설정
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, \`migration_\${new Date().toISOString().replace(/[:.]/g, '_')}.log\`);
const logger = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  console.log(message);
  logger.write(message + '\\n');
}

// 환경 변수 확인
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  log('===== SUPABASE ENV DEBUG =====');
  log(\`NEXT_PUBLIC_SUPABASE_URL: \${process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set'}\`);
  log(\`NEXT_PUBLIC_SUPABASE_ANON_KEY: \${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set but not shown for security' : 'not set'}\`);
  log('=====');
  log('Error: Supabase environment variables are missing');
  process.exit(1);
}

// Supabase 클라이언트 초기화
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateUsers() {
  log('Starting user migration...');
  try {
    // Supabase에서 사용자 데이터 가져오기
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*');

    if (fetchError) {
      log(\`Error fetching users: \${fetchError.message}\`);
      return;
    }

    log(\`Found \${users.length} users to migrate\`);

    for (const user of users) {
      log(\`Migrating user: \${user.email}\`);
      
      // Supabase users 테이블에 삽입
      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role || 'USER',
          profile_image: user.profile_image,
          phone_number: user.phone_number,
          bank_info: user.bank_info,
          created_at: user.created_at,
          updated_at: user.updated_at
        })
        .select();

      if (error) {
        log(\`Error migrating user \${user.email}: \${error.message}\`);
      } else {
        log(\`Successfully migrated user \${user.email}\`);
      }
    }
    log('User migration completed');
  } catch (error) {
    log(\`Error in user migration: \${error.message}\`);
  }
}

async function migratePosts() {
  log('Starting post migration...');
  try {
    // Supabase에서 게시물 데이터 가져오기
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('*');

    if (fetchError) {
      log(\`Error fetching posts: \${fetchError.message}\`);
      return;
    }

    log(\`Found \${posts.length} posts to migrate\`);

    for (const post of posts) {
      log(\`Migrating post: \${post.id} - \${post.title}\`);
      
      // Supabase posts 테이블에 삽입
      const { data, error } = await supabase
        .from('posts')
        .upsert({
          id: post.id,
          title: post.title,
          content: post.content,
          price: post.price,
          status: post.status || 'ACTIVE',
          user_id: post.user_id,
          created_at: post.created_at,
          updated_at: post.updated_at
        })
        .select();

      if (error) {
        log(\`Error migrating post \${post.id}: \${error.message}\`);
      } else {
        log(\`Successfully migrated post \${post.id}\`);
      }
    }
    log('Post migration completed');
  } catch (error) {
    log(\`Error in post migration: \${error.message}\`);
  }
}

async function migrateNotifications() {
  log('Starting notification migration...');
  try {
    // Supabase에서 알림 데이터 가져오기
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*');

    if (fetchError) {
      log(\`Error fetching notifications: \${fetchError.message}\`);
      return;
    }

    log(\`Found \${notifications.length} notifications to migrate\`);

    for (const notification of notifications) {
      log(\`Migrating notification: \${notification.id}\`);
      
      // Supabase notifications 테이블에 삽입
      const { data, error } = await supabase
        .from('notifications')
        .upsert({
          id: notification.id,
          user_id: notification.user_id,
          post_id: notification.post_id,
          message: notification.message,
          type: notification.type,
          is_read: notification.is_read,
          created_at: notification.created_at,
          updated_at: notification.updated_at
        })
        .select();

      if (error) {
        log(\`Error migrating notification \${notification.id}: \${error.message}\`);
      } else {
        log(\`Successfully migrated notification \${notification.id}\`);
      }
    }
    log('Notification migration completed');
  } catch (error) {
    log(\`Error in notification migration: \${error.message}\`);
  }
}

async function main() {
  log('=== Supabase Migration Started ===');
  
  try {
    await migrateUsers();
    await migratePosts();
    await migrateNotifications();
    
    log('=== Supabase Migration Completed Successfully ===');
  } catch (error) {
    log(\`=== Migration Failed: \${error.message} ===\`);
  } finally {
    logger.end();
  }
}

main();
`;

// 임시 마이그레이션 스크립트 파일 생성
const tempMigrationFile = './temp-migrate-data.js';
fs.writeFileSync(tempMigrationFile, migrateDataContent);

// 마이그레이션 스크립트 실행
const migrationProcess = spawn('node', [tempMigrationFile], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

migrationProcess.stdout.on('data', (data) => {
  log(`[OUTPUT] ${data.toString().trim()}`);
});

migrationProcess.stderr.on('data', (data) => {
  log(`[ERROR] ${data.toString().trim()}`);
});

migrationProcess.on('close', (code) => {
  // 임시 파일 삭제
  fs.unlinkSync(tempMigrationFile);
  
  if (code === 0) {
    log('마이그레이션이 성공적으로 완료되었습니다.');
    log('개발 서버를 다시 시작하려면 "pnpm dev"를 실행하세요.');
  } else {
    log(`마이그레이션이 오류 코드 ${code}로 종료되었습니다.`);
    log('로그 파일을 확인하여 오류를 해결하세요.');
  }
  logStream.end();
});

log('마이그레이션 로그는 다음 파일에 저장됩니다: ' + logFile); 