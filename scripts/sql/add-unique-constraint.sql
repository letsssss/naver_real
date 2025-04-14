-- purchases 테이블에 post_id에 유니크 제약 조건 추가
-- 이를 통해 어떤 사용자라도 동일한 post_id는 단 한 번만 구매 가능함

-- 기존 제약조건 확인 (있을 경우 삭제를 위해)
DO $$
BEGIN
    -- 제약조건이 이미 존재하는지 확인
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_post_purchase' AND conrelid = 'purchases'::regclass
    ) THEN
        -- 기존 제약조건 삭제
        EXECUTE 'ALTER TABLE purchases DROP CONSTRAINT unique_post_purchase';
    END IF;
    
    -- 새 제약조건 추가
    EXECUTE 'ALTER TABLE purchases ADD CONSTRAINT unique_post_purchase UNIQUE (post_id)';
    
    RAISE NOTICE 'unique_post_purchase 제약조건이 성공적으로 추가되었습니다.';
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'purchases 테이블이 존재하지 않습니다. 테이블을 먼저 생성하세요.';
    WHEN duplicate_table THEN
        RAISE NOTICE '제약조건이 이미 존재합니다.';
    WHEN others THEN
        RAISE NOTICE '오류 발생: %', SQLERRM;
END$$; 