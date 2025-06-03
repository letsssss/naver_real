-- Drop existing function if it exists
drop function if exists get_average_success_rate();

-- 성공률 평균을 계산하는 함수 생성
create or replace function get_average_success_rate()
returns float
language plpgsql
as $$
declare
  avg_rate float;
begin
  -- 직접 테이블에서 평균 계산
  select coalesce(avg(cancellation_ticketing_rate), 90.0) into avg_rate
  from cancellation_statistics
  where cancellation_ticketing_rate is not null;
  
  return avg_rate;
end;
$$; 