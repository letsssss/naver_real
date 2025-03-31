// Prisma에서 Supabase로 데이터 마이그레이션 스크립트
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// 환경 변수 로드
dotenv.config({ path: '.env.local' });

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 환경 변수 확인
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL 또는 Anon Key가 설정되지 않았습니다.');
  console.log('다음 환경 변수를 .env.local 파일에 설정하세요:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  process.exit(1);
}

// Supabase 클라이언트 초기화
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 마이그레이션 함수
async function migrateData() {
  console.log('데이터 마이그레이션 시작...');
  
  try {
    // 사용자 마이그레이션
    await migrateUsers();
    
    // 게시물 마이그레이션
    await migratePosts();
    
    // 알림 마이그레이션
    await migrateNotifications();
    
    console.log('데이터 마이그레이션 완료!');
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 사용자 데이터 마이그레이션
async function migrateUsers() {
  console.log('사용자 데이터 마이그레이션 시작...');
  
  const users = await prisma.user.findMany();
  console.log(`${users.length}명의 사용자를 마이그레이션합니다.`);
  
  // 기존 사용자 이메일 확인
  const { data: existingUsers } = await supabase
    .from('users')
    .select('email');
  
  const existingEmails = new Set(existingUsers?.map(user => user.email) || []);
  
  let migratedCount = 0;
  for (const user of users) {
    if (existingEmails.has(user.email)) {
      console.log(`사용자 ${user.email}는 이미 존재합니다. 건너뜁니다.`);
      continue;
    }
    
    // Auth 테이블 사용자 생성 (실제로는 Supabase Auth API 사용 필요)
    // 여기서는 이미 Auth가 설정되었다고 가정
    
    // 사용자 정보 삽입
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: user.id.toString(), // UUID로 변환 필요할 수 있음
        email: user.email,
        name: user.name,
        role: user.role || 'USER',
        profile_image: user.profileImage,
        phone_number: user.phoneNumber,
        bank_info: user.bankInfo ? JSON.parse(user.bankInfo) : null,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      });
    
    if (error) {
      console.error(`사용자 ${user.email} 마이그레이션 실패:`, error);
    } else {
      migratedCount++;
      console.log(`사용자 ${user.email} 마이그레이션 성공`);
    }
  }
  
  console.log(`사용자 마이그레이션 완료: ${migratedCount}/${users.length}명 이전됨`);
}

// 게시물 데이터 마이그레이션
async function migratePosts() {
  console.log('게시물 데이터 마이그레이션 시작...');
  
  const posts = await prisma.post.findMany();
  console.log(`${posts.length}개의 게시물을 마이그레이션합니다.`);
  
  // 기존 게시물 ID 확인
  const { data: existingPosts } = await supabase
    .from('posts')
    .select('id');
  
  const existingIds = new Set(existingPosts?.map(post => post.id) || []);
  
  let migratedCount = 0;
  for (const post of posts) {
    if (existingIds.has(post.id.toString())) {
      console.log(`게시물 ID ${post.id}는 이미 존재합니다. 건너뜁니다.`);
      continue;
    }
    
    // 게시물 정보 삽입
    const { data, error } = await supabase
      .from('posts')
      .insert({
        id: post.id,
        title: post.title,
        content: post.content,
        price: post.price,
        status: post.status,
        user_id: post.userId.toString(), // UUID로 변환 필요할 수 있음
        created_at: post.createdAt,
        updated_at: post.updatedAt
      });
    
    if (error) {
      console.error(`게시물 ID ${post.id} 마이그레이션 실패:`, error);
    } else {
      migratedCount++;
      console.log(`게시물 ID ${post.id} 마이그레이션 성공`);
    }
  }
  
  console.log(`게시물 마이그레이션 완료: ${migratedCount}/${posts.length}개 이전됨`);
}

// 알림 데이터 마이그레이션
async function migrateNotifications() {
  console.log('알림 데이터 마이그레이션 시작...');
  
  const notifications = await prisma.notification.findMany();
  console.log(`${notifications.length}개의 알림을 마이그레이션합니다.`);
  
  let migratedCount = 0;
  for (const notification of notifications) {
    // 알림 정보 삽입 (ID는 자동 생성)
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.userId.toString(), // UUID로 변환 필요할 수 있음
        post_id: notification.postId ? notification.postId.toString() : null,
        message: notification.message,
        type: notification.type,
        is_read: notification.isRead,
        created_at: notification.createdAt,
        updated_at: notification.updatedAt
      });
    
    if (error) {
      console.error(`알림 ID ${notification.id} 마이그레이션 실패:`, error);
    } else {
      migratedCount++;
      console.log(`알림 ID ${notification.id} 마이그레이션 성공`);
    }
  }
  
  console.log(`알림 마이그레이션 완료: ${migratedCount}/${notifications.length}개 이전됨`);
}

// 실행
migrateData()
  .then(() => {
    console.log('마이그레이션이 성공적으로 완료되었습니다.');
    process.exit(0);
  })
  .catch(error => {
    console.error('마이그레이션 중 오류 발생:', error);
    process.exit(1);
  }); 