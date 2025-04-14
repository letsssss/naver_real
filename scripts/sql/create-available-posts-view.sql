-- 구매 가능한 게시물만 필터링하는 뷰 생성
-- 이미 구매된 상품(purchases 테이블에 존재하는 post_id)은 제외됩니다.

-- 기존 뷰가 있으면 삭제 후 재생성
DROP VIEW IF EXISTS available_posts;

-- 새 뷰 생성
CREATE OR REPLACE VIEW available_posts AS
SELECT p.*
FROM posts p
LEFT JOIN purchases pur ON p.id = pur.post_id
WHERE pur.id IS NULL -- 구매 내역이 없는 상품
  AND p.status = 'ACTIVE' -- 활성 상태인 상품만
  AND (p.is_deleted IS NULL OR p.is_deleted = false); -- 삭제되지 않은 상품만

COMMENT ON VIEW available_posts IS '구매 가능한 판매 중인 티켓만 보여주는 뷰. 이미 구매된 상품은 제외됨.'; 