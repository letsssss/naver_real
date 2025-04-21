-- 먼저 필요한 확장 프로그램 활성화
create extension if not exists http with schema extensions;

-- 알림 로그 테이블 생성 (아직 없는 경우)
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  message_id uuid not null references public.messages(id),
  notification_type text not null,
  status text not null,
  created_at timestamptz not null default now()
);

-- 알림 로그 테이블에 RLS 정책 추가
alter table public.notification_logs enable row level security;

-- 알림 로그 RLS 정책: 관리자만 모든 로그 조회 가능, 사용자는 자신의 로그만 조회 가능
create policy "Admins can see all logs"
  on public.notification_logs
  for select
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

create policy "Users can only see their own logs"
  on public.notification_logs
  for select
  to authenticated
  using (user_id = auth.uid());

-- 새 메시지 알림 전송 함수
create or replace function notify_new_message()
returns trigger as $$
declare
  receiver_is_online boolean := false;
  webapp_url text := current_setting('app.settings.webapp_url', true);
  webhook_url text := webapp_url || '/api/send-kakao';
begin
  -- 1. 수신자가 현재 온라인 상태인지 확인 (선택적)
  -- 수신자가 온라인 상태일 경우 알림 스킵 (실시간으로 메시지를 볼 수 있으므로)
  -- 이 기능이 필요하지 않으면 주석 처리하거나 제거
  begin
    select exists(
      select 1 from sessions
      where user_id = new.receiver_id
      and last_seen > now() - interval '5 minutes'
    ) into receiver_is_online;
  exception
    when others then
      receiver_is_online := false;
  end;

  -- 수신자가 오프라인일 경우에만 알림 전송
  if receiver_is_online = false then
    -- 2. Webhook 호출하여 알림 전송
    perform extensions.http_post(
      webhook_url,
      json_build_object(
        'sender_id', new.sender_id,
        'receiver_id', new.receiver_id,
        'content', new.content,
        'message_id', new.id,
        'created_at', new.created_at
      )::text,
      'application/json'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 새 메시지 트리거 생성
drop trigger if exists new_message_notification_trigger on public.messages;
create trigger new_message_notification_trigger
after insert on public.messages
for each row
execute procedure notify_new_message(); 