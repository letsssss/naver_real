import { Server } from 'socket.io';
import { supabase } from '@/lib/supabase'; 
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export const config = {
  api: {
    bodyParser: false,
  },
};

const socketHandler = (req, res) => {
  if (res.socket.server.io) {
    console.log('Socket.io 서버가 이미 실행 중입니다.');
    res.end();
    return;
  }

  console.log('Socket.io 서버를 설정합니다...');
  const io = new Server(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
    pingTimeout: 30000,     // 핑 타임아웃 (기본값: 20000)
    pingInterval: 25000,    // 핑 간격 (기본값: 25000)
    upgradeTimeout: 15000,  // 업그레이드 타임아웃 (기본값: 10000)
    maxHttpBufferSize: 1e8, // 최대 HTTP 버퍼 크기 (100MB)
    transports: ['websocket', 'polling'], // 전송 방식
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  
  res.socket.server.io = io;

  // 소켓 연결 이벤트 핸들러
  io.on('connection', (socket) => {
    console.log('새로운 클라이언트 연결됨:', socket.id);
    let currentUser = null;

    // 사용자 인증 처리
    socket.on('authenticate', async (data) => {
      try {
        // 토큰 검증
        if (!data.token) {
          socket.emit('error', { message: '인증 토큰이 필요합니다.' });
          return;
        }

        const decoded = verifyToken(data.token);
        if (!decoded || !decoded.userId) {
          socket.emit('error', { message: '유효하지 않은 토큰입니다.' });
          return;
        }

        // 사용자 정보 조회
        const { data: user, error } = await supabase
          .from('users')
          .select('id, name, profile_image')
          .eq('id', decoded.userId.toString())
          .single();

        if (error || !user) {
          socket.emit('error', { message: '사용자를 찾을 수 없습니다.' });
          return;
        }

        // 사용자 정보 저장
        currentUser = {
          id: user.id,
          name: user.name,
          profileImage: user.profile_image
        };
        socket.emit('authenticated', { user });
        console.log(`사용자 인증 완료: ${user.id} (${user.name})`);
      } catch (error) {
        console.error('인증 오류:', error);
        socket.emit('error', { message: '인증 처리 중 오류가 발생했습니다.' });
      }
    });

    // 채팅방 생성 또는 참가 이벤트
    socket.on('createOrJoinRoom', async (data) => {
      try {
        if (!currentUser) {
          socket.emit('error', { message: '인증이 필요합니다.' });
          return;
        }

        const { purchaseId, sellerId } = data;
        
        if (!purchaseId) {
          socket.emit('error', { message: '구매 ID가 필요합니다.' });
          return;
        }

        // 채팅방 이름 (구매 ID 기반)
        const roomName = `purchase_${purchaseId}`;
        
        // 기존 채팅방 확인
        let { data: room, error: roomError } = await supabase
          .from('rooms')
          .select(`
            id,
            name,
            purchase_id,
            participants:room_participants(
              user_id,
              users:user_id(id, name, profile_image)
            ),
            messages(
              id, 
              content, 
              sender_id, 
              created_at, 
              is_read,
              sender:sender_id(id, name, profile_image)
            )
          `)
          .eq('name', roomName)
          .order('created_at', { foreignTable: 'messages', ascending: true })
          .single();

        // 채팅방이 없으면 새로 생성
        if (roomError || !room) {
          // 판매자 ID 확인
          const { data: seller, error: sellerError } = await supabase
            .from('users')
            .select('id, name')
            .eq('id', sellerId.toString())
            .single();

          if (sellerError || !seller) {
            socket.emit('error', { message: '판매자 정보를 찾을 수 없습니다.' });
            return;
          }

          // 채팅방 생성
          const { data: newRoom, error: createRoomError } = await supabase
            .from('rooms')
            .insert({
              name: roomName,
              purchase_id: Number(purchaseId)
            })
            .select('id')
            .single();

          if (createRoomError || !newRoom) {
            socket.emit('error', { message: '채팅방을 생성할 수 없습니다.' });
            return;
          }

          // 참가자 추가
          const participants = [
            { room_id: newRoom.id, user_id: currentUser.id },
            { room_id: newRoom.id, user_id: seller.id }
          ];

          const { error: participantError } = await supabase
            .from('room_participants')
            .insert(participants);

          if (participantError) {
            socket.emit('error', { message: '참가자를 추가할 수 없습니다.' });
            return;
          }

          // 최종 방 정보 조회
          const { data: finalRoom, error: finalRoomError } = await supabase
            .from('rooms')
            .select(`
              id,
              name,
              purchase_id,
              participants:room_participants(
                user_id,
                users:user_id(id, name, profile_image)
              ),
              messages(
                id, 
                content, 
                sender_id, 
                created_at, 
                is_read,
                sender:sender_id(id, name, profile_image)
              )
            `)
            .eq('id', newRoom.id)
            .single();

          if (finalRoomError) {
            socket.emit('error', { message: '방 정보를 조회할 수 없습니다.' });
            return;
          }

          room = finalRoom;
          console.log(`새 채팅방 생성됨: ${roomName}`);
        } else {
          // 이미 방이 있으면 참가자 확인
          const isParticipant = room.participants.some(p => p.user_id === currentUser.id);
          
          if (!isParticipant) {
            socket.emit('error', { message: '채팅방에 접근할 권한이 없습니다.' });
            return;
          }
        }

        // 소켓을 채팅방에 조인
        socket.join(roomName);
        console.log(`소켓 ${socket.id}가 채팅방 ${roomName}에 참가했습니다.`);

        // 채팅방 정보 및 메시지 전송
        const messages = room.messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.sender_id,
          timestamp: msg.created_at,
          isRead: msg.is_read
        }));

        socket.emit('roomJoined', {
          roomId: roomName,
          participants: room.participants.map(p => ({
            id: p.user_id,
            name: p.users.name,
            profileImage: p.users.profile_image
          })),
          messages
        });
      } catch (error) {
        console.error('채팅방 참가 오류:', error);
        socket.emit('error', { message: '채팅방 참가 중 오류가 발생했습니다.' });
      }
    });

    // 메시지 전송 이벤트
    socket.on('onSend', async (data) => {
      try {
        if (!currentUser) {
          socket.emit('error', { message: '인증이 필요합니다.' });
          return;
        }

        const { roomId, chat } = data;
        
        if (!roomId || !chat) {
          socket.emit('error', { message: '채팅방 ID와 메시지 내용이 필요합니다.' });
          return;
        }

        // 채팅방 확인
        const room = await supabase
          .from('rooms')
          .select(`
            id,
            name,
            purchase_id,
            participants:room_participants(
              user_id,
              users:user_id(id, name, profile_image)
            ),
            messages(
              id, 
              content, 
              sender_id, 
              created_at, 
              is_read,
              sender:sender_id(id, name, profile_image)
            )
          `)
          .eq('name', roomId)
          .order('created_at', { foreignTable: 'messages', ascending: true })
          .single();

        if (!room) {
          socket.emit('error', { message: '채팅방을 찾을 수 없습니다.' });
          return;
        }

        // 참가자 확인
        const isParticipant = room.participants.some(p => p.user_id === currentUser.id);
        if (!isParticipant) {
          socket.emit('error', { message: '채팅방에 참가한 사용자만 메시지를 보낼 수 있습니다.' });
          return;
        }

        // 수신자 찾기 (자신이 아닌 참가자)
        const receiver = room.participants.find(p => p.user_id !== currentUser.id);
        
        if (!receiver) {
          socket.emit('error', { message: '메시지 수신자를 찾을 수 없습니다.' });
          return;
        }

        // 메시지 저장
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .insert({
            content: chat,
            sender_id: currentUser.id,
            receiver_id: receiver.user_id,
            room_id: room.id,
            purchase_id: room.purchase_id,
            is_read: false
          })
          .select('id, content, created_at')
          .single();

        if (messageError) {
          socket.emit('error', { message: '메시지를 저장할 수 없습니다.' });
          return;
        }

        // 채팅방 마지막 메시지 업데이트
        const { error: updateRoomError } = await supabase
          .from('rooms')
          .update({
            last_chat: chat,
            time_of_last_chat: new Date().toISOString()
          })
          .eq('id', room.id);

        if (updateRoomError) {
          console.error('채팅방 업데이트 오류:', updateRoomError);
        }

        // 전체 룸에 메시지 전송
        io.to(roomId).emit('onReceive', {
          messageId: message.id,
          chat: message.content,
          timestamp: message.created_at,
          user: {
            id: currentUser.id,
            name: currentUser.name,
            profileImage: currentUser.profileImage
          }
        });

        console.log(`메시지 전송됨: ${roomId} - ${currentUser.name}: ${chat}`);
      } catch (error) {
        console.error('메시지 전송 오류:', error);
        socket.emit('error', { message: '메시지 전송 중 오류가 발생했습니다.' });
      }
    });

    // 메시지 읽음 처리
    socket.on('markAsRead', async (data) => {
      try {
        if (!currentUser) {
          socket.emit('error', { message: '인증이 필요합니다.' });
          return;
        }

        const { roomId } = data;
        
        if (!roomId) {
          socket.emit('error', { message: '채팅방 ID가 필요합니다.' });
          return;
        }

        // 채팅방 찾기
        const room = await supabase
          .from('rooms')
          .select(`
            id,
            name,
            purchase_id,
            participants:room_participants(
              user_id,
              users:user_id(id, name, profile_image)
            ),
            messages(
              id, 
              content, 
              sender_id, 
              created_at, 
              is_read,
              sender:sender_id(id, name, profile_image)
            )
          `)
          .eq('name', roomId)
          .order('created_at', { foreignTable: 'messages', ascending: true })
          .single();

        if (!room) {
          socket.emit('error', { message: '채팅방을 찾을 수 없습니다.' });
          return;
        }

        // 안 읽은 메시지 찾아서 읽음 처리
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('room_id', room.id)
          .eq('receiver_id', currentUser.id)
          .eq('is_read', false);

        // 메시지 읽음 이벤트 전송
        io.to(roomId).emit('messageRead', { userId: currentUser.id });
        console.log(`메시지 읽음 처리: 룸 ${roomId}, 사용자 ${currentUser.id}`);
      } catch (error) {
        console.error('메시지 읽음 처리 오류:', error);
        socket.emit('error', { message: '메시지 읽음 처리 중 오류가 발생했습니다.' });
      }
    });

    // 채팅방 나가기
    socket.on('leaveRoom', (data) => {
      if (data.roomId) {
        socket.leave(data.roomId);
        console.log(`소켓 ${socket.id}가 채팅방 ${data.roomId}에서 나갔습니다.`);
      }
    });

    // 연결 해제 이벤트
    socket.on('disconnect', () => {
      console.log('클라이언트 연결 해제:', socket.id);
    });
  });

  console.log('Socket.io 서버 설정 완료!');
  res.end();
};

export default socketHandler; 