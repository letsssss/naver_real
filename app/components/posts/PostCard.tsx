import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";

export const POST_TYPE = {
  WANT: 'TICKET_REQUEST',
  SELL: 'TICKET_SALE',
} as const;

export type PostType = typeof POST_TYPE[keyof typeof POST_TYPE];

interface Post {
  id: number;
  type: PostType;
  title: string;
  content: string;
  maxPrice?: number;
  price?: number;
  quantity?: number;
  availableQuantity?: number;
  eventName?: string;
  eventDate?: string;
  eventVenue?: string;
  author: {
    id: string;
    name: string;
    image?: string;
  };
}

interface PostCardProps {
  post: Post;
}

export const PostCard = ({ post }: PostCardProps) => {
  const renderPostContent = () => {
    switch (post.type) {
      case POST_TYPE.WANT:
        return <TicketRequestCard post={post} />;
      case POST_TYPE.SELL:
        return <TicketSaleCard post={post} />;
      default:
        return <DefaultPostCard post={post} />;
    }
  };

  return (
    <div className="post-card">
      {renderPostContent()}
    </div>
  );
};

const TicketRequestCard = ({ post }: { post: Post }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
          구해요
        </Badge>
        <h3 className="font-semibold">{post.title}</h3>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        {post.eventName && (
          <p>공연: {post.eventName}</p>
        )}
        {post.eventDate && (
          <p>날짜: {post.eventDate}</p>
        )}
        {post.eventVenue && (
          <p>장소: {post.eventVenue}</p>
        )}
        <p>희망 가격: {formatPrice(post.maxPrice || 0)}원</p>
        <p>희망 수량: {post.quantity || 1}매</p>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <span>요청자: {post.author.name}</span>
      </div>
    </div>
  );
};

const TicketSaleCard = ({ post }: { post: Post }) => {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">
          팔아요
        </Badge>
        <h3 className="font-semibold">{post.title}</h3>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        {post.eventName && (
          <p>공연: {post.eventName}</p>
        )}
        {post.eventDate && (
          <p>날짜: {post.eventDate}</p>
        )}
        {post.eventVenue && (
          <p>장소: {post.eventVenue}</p>
        )}
        <p>판매 가격: {formatPrice(post.price || 0)}원</p>
        <p>남은 수량: {post.availableQuantity || 0}매</p>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <span>판매자: {post.author.name}</span>
      </div>
    </div>
  );
};

const DefaultPostCard = ({ post }: { post: Post }) => {
  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-all">
      <h3 className="font-semibold mb-2">{post.title}</h3>
      <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
      <div className="mt-4 text-xs text-gray-500">
        <span>작성자: {post.author.name}</span>
      </div>
    </div>
  );
}; 