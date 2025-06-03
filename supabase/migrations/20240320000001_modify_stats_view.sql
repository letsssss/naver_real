-- Drop the view as we're using the function instead
drop view if exists cancellation_ticketing_stats_view;

-- Create a new view that returns a single row with the average
create or replace view cancellation_ticketing_stats_view as
select 
  coalesce(avg(cancellation_ticketing_rate), 90) as average_rate,
  count(*) as total_count
from (
  -- Your original view query here
  select cancellation_ticketing_rate
  from cancellation_statistics
  where cancellation_ticketing_rate is not null
) as stats; 