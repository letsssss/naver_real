-- Supabase에 auth_logs 테이블 생성
create table if not exists auth_logs (
  id uuid primary key default gen_random_uuid(),
  type text, -- signup, login, etc.
  email text,
  status text, -- success, fail
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamp default now()
);

-- 테이블에 인덱스 추가 (검색 성능 향상)
create index if not exists auth_logs_email_idx on auth_logs(email);
create index if not exists auth_logs_type_idx on auth_logs(type);
create index if not exists auth_logs_status_idx on auth_logs(status);
create index if not exists auth_logs_created_at_idx on auth_logs(created_at);

-- 자동 만료 정책을 위한 칼럼 추가
alter table auth_logs add column if not exists expires_at timestamp default (now() + interval '90 days');
create index if not exists auth_logs_expires_at_idx on auth_logs(expires_at);

-- 오래된 로그 정리를 위한 함수 생성
create or replace function cleanup_expired_auth_logs() returns void as $$
begin
  delete from auth_logs where expires_at < now();
end;
$$ language plpgsql;

-- 적절한 권한 설정
alter table auth_logs enable row level security;

-- RLS 정책: 관리자만 접근 가능
create policy "Only admins can view auth logs" 
  on auth_logs
  for all
  using (auth.jwt() ->> 'role' = 'ADMIN');

-- 인증 서비스는 항상 입력할 수 있도록 정책 추가
create policy "Service can insert auth logs" 
  on auth_logs
  for insert
  to authenticated, anon
  with check (true);

-- 코멘트 추가
comment on table auth_logs is '인증 관련 이벤트(회원가입, 로그인 등) 로그';
comment on column auth_logs.type is '인증 유형 (signup, login, password_reset 등)';
comment on column auth_logs.status is '처리 상태 (success, fail)';
comment on column auth_logs.error_message is '실패 시 오류 메시지';
comment on column auth_logs.expires_at is '로그 자동 삭제 시점 (개인정보 보호용)'; 