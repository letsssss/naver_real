import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import https from 'https';

const supabaseUrl = 'https://jdubrjczdyqqtsppojgu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

console.log('Supabase 연결 테스트 시작...');

// 1. 기본 HTTPS 요청 테스트
const agent = new https.Agent({
  rejectUnauthorized: false,
});

// 2. API 엔드포인트 테스트
fetch('https://supabase.com', { agent })
  .then(response => {
    console.log('기본 도메인 연결 테스트 성공:', response.status);
    
    // 2. Supabase 프로젝트 도메인 테스트
    return fetch(supabaseUrl, { agent });
  })
  .then(response => {
    console.log('Supabase 프로젝트 도메인 테스트 성공:', response.status);
    
    // 3. Supabase API 엔드포인트 테스트
    return fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      agent
    });
  })
  .then(response => {
    console.log('Supabase API 엔드포인트 테스트 성공:', response.status);
    
    // 4. Supabase 클라이언트 초기화 테스트
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Supabase 클라이언트 초기화 성공');
      
      // 5. 간단한 쿼리 테스트
      return supabase.from('notifications').select('*').limit(1);
    } catch (error) {
      console.error('Supabase 클라이언트 초기화 실패:', error);
      throw error;
    }
  })
  .then(({ data, error }) => {
    if (error) {
      console.error('Supabase 쿼리 실패:', error);
    } else {
      console.log('Supabase 쿼리 성공, 결과:', data);
    }
    console.log('모든 테스트 완료');
  })
  .catch(error => {
    console.error('Supabase 연결 테스트 실패:', error);
  }); 