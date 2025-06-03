export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  isMine: boolean;
  status?: 'sending' | 'sent' | 'failed';
  isRead?: boolean;
  transactionId?: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  lastMessage?: Message;
  unreadCount: number;
  participants: ChatParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatParticipant {
  id: string;
  name: string;
  profileImage?: string;
  lastSeen?: string;
  isOnline?: boolean;
}

export interface ChatNotification {
  id: string;
  type: 'message' | 'system';
  message: string;
  chatRoomId: string;
  createdAt: string;
  isRead: boolean;
}

export interface ChatState {
  activeRoomId: string | null;
  rooms: ChatRoom[];
  messages: Record<string, Message[]>;
  participants: Record<string, ChatParticipant[]>;
  notifications: ChatNotification[];
  isLoading: boolean;
  error: string | null;
}

export interface ChatContextType extends ChatState {
  sendMessage: (roomId: string, content: string) => Promise<boolean>;
  markAsRead: (roomId: string) => Promise<boolean>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  clearNotifications: (roomId: string) => void;
} 