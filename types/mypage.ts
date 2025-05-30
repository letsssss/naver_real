// 트랜잭션 상태 타입 정의
export interface TransactionStatus {
  취켓팅진행중: number
  판매중인상품: number
  취켓팅완료: number
  거래완료: number
  거래취소: number
}

// 판매 중인 상품 타입 정의
export interface Sale {
  id: number;
  orderNumber?: string;
  title: string;
  date: string;
  price: string;
  status: string;
  isActive: boolean;
  sortPriority: number;
  transaction_type?: 'direct_purchase' | 'proposal_transaction' | 'user_proposal';
}

// 알림 타입 정의
export interface Notification {
  id: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  postId?: number;
}

// 구매 항목 타입 정의
export interface Purchase {
  id: number;
  order_number?: string;
  orderNumber?: string;
  postId?: number;
  title: string;
  ticketTitle?: string;
  eventName?: string;
  post?: any;
  status: string;
  seller: string;
  sellerId?: number;
  quantity: number;
  price: number | string;
  createdAt: string;
  updatedAt: string;
} 