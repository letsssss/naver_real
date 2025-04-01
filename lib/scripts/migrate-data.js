// Prisma에서 Supabase로 데이터 마이그레이션 스크립트
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 로깅 설정
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, `migration_${new Date().toISOString().replace(/[:.]/g, '_')}.log`);
const logger = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  console.log(message);
  logger.write(message + '\n');
}

// 환경 변수 확인
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  log('===== SUPABASE ENV DEBUG =====');
  log(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set'}`);
  log(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set but not shown for security' : 'not set'}`);
  log('=====');
  log('Error: Supabase environment variables are missing');
  process.exit(1);
}

// 클라이언트 초기화
// Prisma 클라이언트 제거됨, Supabase 사용;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateUsers() {
  log('Starting user migration...');
  try {
    const users = await prisma.user.findMany();
    log(`Found ${users.length} users to migrate`);

    for (const user of users) {
      log(`Migrating user: ${user.email}`);
      
      // Supabase users 테이블에 삽입
      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role || 'USER',
          profile_image: user.profileImage,
          phone_number: user.phoneNumber,
          bank_info: user.bankInfo,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        })
        .select();

      if (error) {
        log(`Error migrating user ${user.email}: ${error.message}`);
      } else {
        log(`Successfully migrated user ${user.email}`);
      }
    }
    log('User migration completed');
  } catch (error) {
    log(`Error in user migration: ${error.message}`);
  }
}

async function migratePosts() {
  log('Starting post migration...');
  try {
    const posts = await prisma.post.findMany();
    log(`Found ${posts.length} posts to migrate`);

    for (const post of posts) {
      log(`Migrating post: ${post.id} - ${post.title}`);
      
      // Supabase posts 테이블에 삽입
      const { data, error } = await supabase
        .from('posts')
        .upsert({
          id: post.id,
          title: post.title,
          content: post.content,
          price: post.price,
          status: post.status || 'ACTIVE',
          user_id: post.userId,
          created_at: post.createdAt,
          updated_at: post.updatedAt
        })
        .select();

      if (error) {
        log(`Error migrating post ${post.id}: ${error.message}`);
      } else {
        log(`Successfully migrated post ${post.id}`);
      }
    }
    log('Post migration completed');
  } catch (error) {
    log(`Error in post migration: ${error.message}`);
  }
}

async function migrateNotifications() {
  log('Starting notification migration...');
  try {
    const notifications = await prisma.notification.findMany();
    log(`Found ${notifications.length} notifications to migrate`);

    for (const notification of notifications) {
      log(`Migrating notification: ${notification.id}`);
      
      // Supabase notifications 테이블에 삽입
      const { data, error } = await supabase
        .from('notifications')
        .upsert({
          id: notification.id,
          user_id: notification.userId,
          post_id: notification.postId,
          message: notification.message,
          type: notification.type,
          is_read: notification.isRead,
          created_at: notification.createdAt,
          updated_at: notification.updatedAt
        })
        .select();

      if (error) {
        log(`Error migrating notification ${notification.id}: ${error.message}`);
      } else {
        log(`Successfully migrated notification ${notification.id}`);
      }
    }
    log('Notification migration completed');
  } catch (error) {
    log(`Error in notification migration: ${error.message}`);
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
    log(`=== Migration Failed: ${error.message} ===`);
  } finally {
    await prisma.$disconnect();
    logger.end();
  }
}

main(); 