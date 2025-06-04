-- rooms 테이블의 order_number에 unique constraint 추가
-- 이렇게 하면 하나의 주문번호에 대해 하나의 채팅방만 생성됩니다.

-- 1. 먼저 기존 중복 데이터가 있는지 확인
SELECT order_number, COUNT(*) as count 
FROM public.rooms 
WHERE order_number IS NOT NULL 
GROUP BY order_number 
HAVING COUNT(*) > 1;

-- 2. 중복된 데이터가 있다면 제거 (가장 최신 것만 남기고 나머지 삭제)
WITH ranked_rooms AS (
  SELECT id, 
         order_number,
         ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY created_at DESC) as rn
  FROM public.rooms 
  WHERE order_number IS NOT NULL
)
DELETE FROM public.rooms 
WHERE id IN (
  SELECT id FROM ranked_rooms WHERE rn > 1
);

-- 3. order_number에 unique constraint 추가
ALTER TABLE public.rooms 
ADD CONSTRAINT unique_order_number 
UNIQUE (order_number);

-- 4. 확인: constraint가 제대로 추가되었는지 체크
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' 
  AND tc.table_name = 'rooms'
  AND tc.table_schema = 'public'; 