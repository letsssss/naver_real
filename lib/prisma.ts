/**
 * DEPRECATED: Prisma에서 Supabase로 마이그레이션 완료
 * 이 파일은 레거시 코드와의 호환성을 위해 유지됩니다.
 * 새로운 코드는 lib/supabase.ts를 직접 사용해야 합니다.
 */

import { supabase } from './supabase';

// PrismaClient 코드 제거 - 패키지가 더 이상 존재하지 않음
// 래퍼 클래스를 통해 동일한 인터페이스 제공

// Prisma API를 에뮬레이션하는 래퍼 클래스
class SupabaseWrapper {
  // 사용자 관련 메서드
  user = {
    findUnique: async (args: any) => {
      const { where, select } = args;
      
      console.log('Prisma 호환 래퍼: user.findUnique 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('users')
          .select(this._formatSelect(select))
          .eq('id', where.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 조회 오류:', error);
        }
        
        return data;
      }
      
      if (where.email) {
        const { data, error } = await supabase
          .from('users')
          .select(this._formatSelect(select))
          .eq('email', where.email.toLowerCase())
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 조회 오류:', error);
        }
        
        return data;
      }
      
      return null;
    },
    
    findMany: async (args: any) => {
      const { where, select, orderBy, take, skip } = args || {};
      
      console.log('Prisma 호환 래퍼: user.findMany 호출');
      
      let query = supabase
        .from('users')
        .select(this._formatSelect(select));
      
      // 조건 적용
      if (where) {
        if (where.id) query = query.eq('id', where.id);
        if (where.email) query = query.eq('email', where.email.toLowerCase());
        if (where.role) query = query.eq('role', where.role);
        // 다른 조건들...
      }
      
      // 정렬 적용
      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field] === 'desc' ? false : true;
        query = query.order(field, { ascending: direction });
      }
      
      // 페이지네이션
      if (skip) query = query.range(skip, skip + (take || 10) - 1);
      else if (take) query = query.limit(take);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 조회 오류:', error);
        return [];
      }
      
      return data || [];
    },
    
    update: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: user.update 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', where.id)
          .select()
          .single();
          
        if (error) {
          console.error('Supabase 업데이트 오류:', error);
          return null;
        }
        
        return data;
      }
      
      if (where.email) {
        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('email', where.email.toLowerCase())
          .select()
          .single();
          
        if (error) {
          console.error('Supabase 업데이트 오류:', error);
          return null;
        }
        
        return data;
      }
      
      return null;
    },
    
    create: async (args: any) => {
      const { data: createData } = args;
      
      console.log('Prisma 호환 래퍼: user.create 호출');
      
      // 이메일을 소문자로 변환
      if (createData.email) {
        createData.email = createData.email.toLowerCase();
      }
      
      const { data, error } = await supabase
        .from('users')
        .insert(createData)
        .select()
        .single();
        
      if (error) {
        console.error('Supabase 생성 오류:', error);
        return null;
      }
      
      return data;
    },
    
    delete: async (args: any) => {
      const { where } = args;
      
      console.log('Prisma 호환 래퍼: user.delete 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('users')
          .delete()
          .eq('id', where.id)
          .select()
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 삭제 오류:', error);
          return null;
        }
        
        return data;
      }
      
      return null;
    }
  };
  
  // 게시물 관련 메서드
  post = {
    findUnique: async (args: any) => {
      const { where, select } = args;
      
      console.log('Prisma 호환 래퍼: post.findUnique 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('posts')
          .select(this._formatSelect(select))
          .eq('id', where.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 조회 오류:', error);
        }
        
        return data;
      }
      
      return null;
    },
    
    findMany: async (args: any) => {
      const { where, select, orderBy, take, skip } = args || {};
      
      console.log('Prisma 호환 래퍼: post.findMany 호출');
      
      let query = supabase
        .from('posts')
        .select(this._formatSelect(select));
      
      // 조건 적용
      if (where) {
        if (where.id) query = query.eq('id', where.id);
        if (where.authorId) query = query.eq('author_id', where.authorId);
        if (where.category) query = query.eq('category', where.category);
        if (where.published) query = query.eq('published', where.published);
        // 다른 조건들...
      }
      
      // 정렬 적용
      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field] === 'desc' ? false : true;
        query = query.order(field, { ascending: direction });
      }
      
      // 페이지네이션
      if (skip) query = query.range(skip, skip + (take || 10) - 1);
      else if (take) query = query.limit(take);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 조회 오류:', error);
        return [];
      }
      
      return data || [];
    },
    
    create: async (args: any) => {
      const { data: createData } = args;
      
      console.log('Prisma 호환 래퍼: post.create 호출');
      
      const { data, error } = await supabase
        .from('posts')
        .insert(createData)
        .select()
        .single();
        
      if (error) {
        console.error('Supabase 생성 오류:', error);
        return null;
      }
      
      return data;
    },
    
    update: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: post.update 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('posts')
          .update(updateData)
          .eq('id', where.id)
          .select()
          .single();
          
        if (error) {
          console.error('Supabase 업데이트 오류:', error);
          return null;
        }
        
        return data;
      }
      
      return null;
    },
    
    delete: async (args: any) => {
      const { where } = args;
      
      console.log('Prisma 호환 래퍼: post.delete 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('posts')
          .delete()
          .eq('id', where.id)
          .select()
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 삭제 오류:', error);
          return null;
        }
        
        return data;
      }
      
      return null;
    }
  };
  
  // 티켓 관련 메서드
  ticket = {
    findUnique: async (args: any) => {
      const { where, select } = args;
      
      console.log('Prisma 호환 래퍼: ticket.findUnique 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('tickets')
          .select(this._formatSelect(select))
          .eq('id', where.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 조회 오류:', error);
        }
        
        return data;
      }
      
      return null;
    },
    
    findMany: async (args: any) => {
      const { where, select, orderBy, take, skip } = args || {};
      
      console.log('Prisma 호환 래퍼: ticket.findMany 호출');
      
      let query = supabase
        .from('tickets')
        .select(this._formatSelect(select));
      
      // 조건 적용
      if (where) {
        if (where.id) query = query.eq('id', where.id);
        if (where.userId) query = query.eq('user_id', where.userId);
        if (where.status) query = query.eq('status', where.status);
        // 다른 조건들...
      }
      
      // 정렬 적용
      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field] === 'desc' ? false : true;
        query = query.order(field, { ascending: direction });
      }
      
      // 페이지네이션
      if (skip) query = query.range(skip, skip + (take || 10) - 1);
      else if (take) query = query.limit(take);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 조회 오류:', error);
        return [];
      }
      
      return data || [];
    },
    
    create: async (args: any) => {
      const { data: createData } = args;
      
      console.log('Prisma 호환 래퍼: ticket.create 호출');
      
      const { data, error } = await supabase
        .from('tickets')
        .insert(createData)
        .select()
        .single();
        
      if (error) {
        console.error('Supabase 생성 오류:', error);
        return null;
      }
      
      return data;
    },
    
    update: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: ticket.update 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('tickets')
          .update(updateData)
          .eq('id', where.id)
          .select()
          .single();
          
        if (error) {
          console.error('Supabase 업데이트 오류:', error);
          return null;
        }
        
        return data;
      }
      
      return null;
    },
    
    delete: async (args: any) => {
      const { where } = args;
      
      console.log('Prisma 호환 래퍼: ticket.delete 호출', where);
      
      if (where.id) {
        const { data, error } = await supabase
          .from('tickets')
          .delete()
          .eq('id', where.id)
          .select()
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 삭제 오류:', error);
          return null;
        }
        
        return data;
      }
      
      return null;
    }
  };
  
  // 알림 관련 메서드
  notification = {
    findMany: async (args: any) => {
      const { where, select, orderBy, take, skip } = args || {};
      
      console.log('Prisma 호환 래퍼: notification.findMany 호출');
      
      let query = supabase
        .from('notifications')
        .select(this._formatSelect(select));
      
      // 조건 적용
      if (where) {
        if (where.userId) query = query.eq('user_id', where.userId);
        if (where.isRead !== undefined) query = query.eq('is_read', where.isRead);
      }
      
      // 정렬 적용
      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field] === 'desc' ? false : true;
        query = query.order(field, { ascending: direction });
      } else {
        // 기본 정렬: 최신순
        query = query.order('created_at', { ascending: false });
      }
      
      // 페이지네이션
      if (skip) query = query.range(skip, skip + (take || 10) - 1);
      else if (take) query = query.limit(take);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 조회 오류:', error);
        return [];
      }
      
      return data || [];
    },
    
    create: async (args: any) => {
      const { data: createData } = args;
      
      console.log('Prisma 호환 래퍼: notification.create 호출');
      
      // ID가 숫자일 경우 UUID로 변환 (가능한 경우)
      if (createData.userId && typeof createData.userId === 'number') {
        createData.userId = String(createData.userId);
        console.log('사용자 ID 숫자를 문자열로 변환:', createData.userId);
      }
      
      const { data, error } = await supabase
        .from('notifications')
        .insert(createData)
        .select()
        .single();
        
      if (error) {
        console.error('Supabase 생성 오류:', error);
        return null;
      }
      
      return data;
    },
    
    update: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: notification.update 호출', where);
      
      let query = supabase
        .from('notifications')
        .update(updateData);
      
      if (where.id) {
        // ID가 숫자일 경우 UUID로 변환
        const id = typeof where.id === 'number' ? String(where.id) : where.id;
        query = query.eq('id', id);
      } else if (where.userId) {
        // 사용자 ID가 숫자일 경우 UUID로 변환
        const userId = typeof where.userId === 'number' ? String(where.userId) : where.userId;
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.select();
      
      if (error) {
        console.error('Supabase 업데이트 오류:', error);
        return null;
      }
      
      return data;
    },
    
    updateMany: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: notification.updateMany 호출', where);
      
      let query = supabase
        .from('notifications')
        .update(updateData);
      
      if (where.userId) {
        // 사용자 ID가 숫자일 경우 UUID로 변환
        const userId = typeof where.userId === 'number' ? String(where.userId) : where.userId;
        query = query.eq('user_id', userId);
      }
      
      if (where.isRead !== undefined) {
        query = query.eq('is_read', where.isRead);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 업데이트 오류:', error);
        return { count: 0 };
      }
      
      // 타입 안전하게 처리
      return { count: data ? (data as any[]).length : 0 };
    }
  };
  
  // 채팅방 관련 메서드
  room = {
    findUnique: async ({ where, include }: {
      where: { name?: string, id?: number },
      include?: {
        participants?: {
          include?: {
            user?: boolean | { select?: any }
          }
        },
        messages?: boolean,
        purchase?: boolean
      }
    }) => {
      console.log('Prisma 호환 래퍼: room.findUnique 호출', where);
      
      let selectQuery = '*';
      
      // Supabase 조인 쿼리 구성
      const relations = [];
      
      if (include) {
        if (include.participants) {
          if (include.participants.include?.user) {
            // user가 객체인 경우 (select 포함) 처리
            if (typeof include.participants.include.user === 'object' && include.participants.include.user.select) {
              const userFields = Object.keys(include.participants.include.user.select)
                .filter(key => include.participants.include?.user && 
                  typeof include.participants.include.user === 'object' && 
                  (include.participants.include.user as any).select[key]
                ).join(',');
              relations.push(`participants(*, user:users(${userFields}))`);
            } else {
              // user가 true인 경우
              relations.push('participants(*, user:users(*))');
            }
          } else {
            relations.push('participants(*)');
          }
        }
        
        if (include.messages) {
          relations.push('messages(*)');
        }
        
        if (include.purchase) {
          relations.push('purchase:purchases(*)');
        }
        
        if (relations.length > 0) {
          selectQuery = `*, ${relations.join(', ')}`;
        }
      }
      
      // name으로 찾기
      if (where.name) {
        const { data, error } = await supabase
          .from('rooms')
          .select(selectQuery)
          .eq('name', where.name)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 방 조회 오류:', error);
        }
        
        return data;
      }
      
      // id로 찾기
      if (where.id) {
        const { data, error } = await supabase
          .from('rooms')
          .select(selectQuery)
          .eq('id', where.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 방 조회 오류:', error);
        }
        
        return data;
      }
      
      return null;
    },
    
    findFirst: async (args: any) => {
      const { where, include } = args;
      
      console.log('Prisma 호환 래퍼: room.findFirst 호출', where);
      
      let selectQuery = '*';
      
      // include 처리 (참조 테이블 조회)
      if (include) {
        const relations = [];
        if (include.participants) {
          if (include.participants.include?.user) {
            // user가 객체인 경우 (select 포함) 처리
            if (typeof include.participants.include.user === 'object' && include.participants.include.user.select) {
              const userFields = Object.keys(include.participants.include.user.select)
                .filter(key => include.participants.include?.user && 
                  typeof include.participants.include.user === 'object' && 
                  (include.participants.include.user as any).select[key]
                ).join(',');
              relations.push(`participants(*, user:users(${userFields}))`);
            } else {
              // user가 true인 경우
              relations.push('participants(*, user:users(*))');
            }
          } else {
            relations.push('participants(*)');
          }
        }
        if (include.messages) relations.push('messages(*)');
        if (include.purchase) relations.push('purchase:purchases(*)');
        
        if (relations.length > 0) {
          selectQuery = `*, ${relations.join(', ')}`;
        }
      }
      
      let query = supabase
        .from('rooms')
        .select(selectQuery)
        .limit(1);
      
      // 필터 조건 적용
      if (where) {
        if (where.name) query = query.eq('name', where.name);
        if (where.id) query = query.eq('id', where.id);
        if (where.purchaseId) query = query.eq('purchase_id', where.purchaseId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 방 조회 오류:', error);
        return null;
      }
      
      return data && data.length > 0 ? data[0] : null;
    },
    
    create: async (args: any) => {
      const { data: createData, include } = args;
      
      console.log('Prisma 호환 래퍼: room.create 호출', createData);
      
      // Prisma => Supabase 키 변환
      const roomData: any = { ...createData };
      
      // 관계 데이터 처리
      const participants = roomData.participants?.create || [];
      delete roomData.participants;
      
      // 메인 레코드 생성
      const { data: room, error } = await supabase
        .from('rooms')
        .insert(roomData)
        .select('*')
        .single();
        
      if (error) {
        console.error('Supabase 방 생성 오류:', error);
        return null;
      }
      
      // 참가자 생성 (있는 경우)
      if (participants.length > 0) {
        for (const participant of Array.isArray(participants) ? participants : [participants]) {
          const participantData = {
            room_id: room.id,
            user_id: participant.userId
          };
          
          const { error: partError } = await supabase
            .from('room_participants')
            .insert(participantData);
            
          if (partError) {
            console.error('Supabase 참가자 생성 오류:', partError);
          }
        }
      }
      
      // include 처리 - 관련 데이터가 필요한 경우 다시 조회
      if (include && (include.participants || include.messages)) {
        let selectQuery = '*';
        const relations = [];
        if (include.participants) {
          if (include.participants.include?.user) {
            // user가 객체인 경우 (select 포함) 처리
            if (typeof include.participants.include.user === 'object' && include.participants.include.user.select) {
              const userFields = Object.keys(include.participants.include.user.select)
                .filter(key => include.participants.include?.user && 
                  typeof include.participants.include.user === 'object' && 
                  (include.participants.include.user as any).select[key]
                ).join(',');
              relations.push(`participants(*, user:users(${userFields}))`);
            } else {
              // user가 true인 경우
              relations.push('participants(*, user:users(*))');
            }
          } else {
            relations.push('participants(*)');
          }
        }
        if (include.messages) relations.push('messages(*)');
        
        if (relations.length > 0) {
          selectQuery = `*, ${relations.join(', ')}`;
        }
        
        const { data: fullRoom, error: fetchError } = await supabase
          .from('rooms')
          .select(selectQuery)
          .eq('id', room.id)
          .single();
          
        if (fetchError) {
          console.error('Supabase 방 재조회 오류:', fetchError);
          return room;
        }
        
        return fullRoom;
      }
      
      return room;
    },
    
    update: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: room.update 호출', where, updateData);
      
      if (!where || (!where.id && !where.name)) {
        console.error('Supabase 방 업데이트 오류: 필수 식별자 누락');
        return null;
      }
      
      let query = supabase
        .from('rooms')
        .update(updateData);
      
      if (where.id) {
        query = query.eq('id', where.id);
      } else if (where.name) {
        query = query.eq('name', where.name);
      }
      
      const { data, error } = await query.select().single();
      
      if (error) {
        console.error('Supabase 방 업데이트 오류:', error);
        return null;
      }
      
      return data;
    },
    
    findMany: async (args: any) => {
      const { where, include, orderBy } = args || {};
      
      console.log('Prisma 호환 래퍼: room.findMany 호출');
      
      let selectQuery = '*';
      
      // include 처리
      if (include) {
        const relations = [];
        if (include.participants) {
          if (include.participants.include?.user) {
            // user가 객체인 경우 (select 포함) 처리
            if (typeof include.participants.include.user === 'object' && include.participants.include.user.select) {
              const userFields = Object.keys(include.participants.include.user.select)
                .filter(key => include.participants.include?.user && 
                  typeof include.participants.include.user === 'object' && 
                  (include.participants.include.user as any).select[key]
                ).join(',');
              relations.push(`participants(*, user:users(${userFields}))`);
            } else {
              // user가 true인 경우
              relations.push('participants(*, user:users(*))');
            }
          } else {
            relations.push('participants(*)');
          }
        }
        if (include.messages) relations.push('messages(*)');
        if (include.purchase) relations.push('purchase:purchases(*)');
        
        if (relations.length > 0) {
          selectQuery = `*, ${relations.join(', ')}`;
        }
      }
      
      let query = supabase
        .from('rooms')
        .select(selectQuery);
      
      // 조건 적용
      if (where) {
        if (where.name) query = query.eq('name', where.name);
        if (where.id) query = query.eq('id', where.id);
        if (where.purchaseId) query = query.eq('purchase_id', where.purchaseId);
      }
      
      // 정렬 적용
      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field] === 'desc' ? false : true;
        query = query.order(field, { ascending: direction });
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 방 조회 오류:', error);
        return [];
      }
      
      return data || [];
    }
  };
  
  // 메시지 관련 메서드
  message = {
    findMany: async (args: any) => {
      const { where, orderBy, include, select } = args;
      
      console.log('Prisma 호환 래퍼: message.findMany 호출', where);
      
      let selectQuery = this._formatSelect(select) || '*';
      
      // include 처리
      if (include) {
        const relations = [];
        if (include.sender) {
          const senderFields = include.sender.select ? 
            Object.keys(include.sender.select).filter(k => include.sender.select[k]).join(',') : 
            '*';
          relations.push(`sender:users(${senderFields})`);
        }
        if (include.receiver) relations.push('receiver:users(*)');
        if (include.room) relations.push('room:rooms(*)');
        
        if (relations.length > 0) {
          selectQuery = `${selectQuery}, ${relations.join(', ')}`;
        }
      }
      
      let query = supabase
        .from('messages')
        .select(selectQuery);
      
      // 조건 필터링
      if (where) {
        if (where.id) query = query.eq('id', where.id);
        if (where.roomId) query = query.eq('room_id', where.roomId);
        if (where.senderId) query = query.eq('sender_id', where.senderId);
        if (where.receiverId) query = query.eq('receiver_id', where.receiverId);
        if (where.isRead !== undefined) query = query.eq('is_read', where.isRead);
        
        // 방 관계 조건
        if (where.room?.id) {
          query = query.eq('room_id', where.room.id);
        }
      }
      
      // 정렬
      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field] === 'desc' ? false : true;
        query = query.order(field, { ascending: direction });
      } else {
        // 기본 정렬: 생성 시간순
        query = query.order('created_at', { ascending: true });
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 메시지 조회 오류:', error);
        return [];
      }
      
      return data || [];
    },
    
    create: async (args: any) => {
      const { data: messageData } = args;
      
      console.log('Prisma 호환 래퍼: message.create 호출');
      
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select('*')
        .single();
        
      if (error) {
        console.error('Supabase 메시지 생성 오류:', error);
        return null;
      }
      
      return data;
    },
    
    updateMany: async (args: any) => {
      const { where, data: updateData } = args;
      
      console.log('Prisma 호환 래퍼: message.updateMany 호출', where, updateData);
      
      if (!where) {
        console.error('Supabase 메시지 업데이트 오류: 필터 조건 누락');
        return { count: 0 };
      }
      
      let query = supabase
        .from('messages')
        .update(updateData);
      
      // 조건 필터링
      if (where.id) query = query.eq('id', where.id);
      if (where.roomId) query = query.eq('room_id', where.roomId);
      if (where.receiverId) query = query.eq('receiver_id', where.receiverId);
      if (where.isRead !== undefined) query = query.eq('is_read', where.isRead);
      
      // 방 관계 조건
      if (where.room?.id) {
        query = query.eq('room_id', where.room.id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 메시지 업데이트 오류:', error);
        return { count: 0 };
      }
      
      // 타입 안전하게 처리
      return { count: data ? (data as any[]).length : 0 };
    }
  };
  
  // 채팅방 참가자 관련 메서드
  roomParticipant = {
    findFirst: async (args: any) => {
      const { where } = args;
      
      console.log('Prisma 호환 래퍼: roomParticipant.findFirst 호출', where);
      
      let query = supabase
        .from('room_participants')
        .select('*')
        .limit(1);
      
      if (where) {
        if (where.roomId) query = query.eq('room_id', where.roomId);
        if (where.userId) query = query.eq('user_id', where.userId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 참가자 조회 오류:', error);
        return null;
      }
      
      return data && data.length > 0 ? data[0] : null;
    },
    
    findMany: async (args: any) => {
      const { where, include } = args;
      
      console.log('Prisma 호환 래퍼: roomParticipant.findMany 호출', where);
      
      let selectQuery = '*';
      
      // include 처리
      if (include) {
        const relations = [];
        if (include.user) relations.push('user:users(*)');
        if (include.room) relations.push('room:rooms(*)');
        
        if (relations.length > 0) {
          selectQuery = `*, ${relations.join(', ')}`;
        }
      }
      
      let query = supabase
        .from('room_participants')
        .select(selectQuery);
      
      if (where) {
        if (where.roomId) query = query.eq('room_id', where.roomId);
        if (where.userId) query = query.eq('user_id', where.userId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 참가자 조회 오류:', error);
        return [];
      }
      
      return data || [];
    }
  };
  
  // 결제/구매 관련 메서드
  purchase = {
    findUnique: async (args: any) => {
      const { where, include } = args;
      
      console.log('Prisma 호환 래퍼: purchase.findUnique 호출', where);
      
      let selectQuery = '*';
      
      // include 처리
      if (include) {
        const relations = [];
        if (include.buyer) relations.push('buyer:users(*)');
        if (include.seller) relations.push('seller:users(*)');
        if (include.post) relations.push('post:posts(*)');
        
        if (relations.length > 0) {
          selectQuery = `*, ${relations.join(', ')}`;
        }
      }
      
      if (where.id) {
        const { data, error } = await supabase
          .from('purchases')
          .select(selectQuery)
          .eq('id', where.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 구매 조회 오류:', error);
        }
        
        return data;
      }
      
      if (where.orderNumber) {
        const { data, error } = await supabase
          .from('purchases')
          .select(selectQuery)
          .eq('order_number', where.orderNumber)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase 구매 조회 오류:', error);
        }
        
        return data;
      }
      
      return null;
    },
    
    findFirst: async (args: any) => {
      const { where, include } = args;
      
      console.log('Prisma 호환 래퍼: purchase.findFirst 호출', where);
      
      let selectQuery = '*';
      
      // include 처리
      if (include) {
        const relations = [];
        if (include.buyer) relations.push('buyer:users(*)');
        if (include.seller) relations.push('seller:users(*)');
        if (include.post) relations.push('post:posts(*)');
        
        if (relations.length > 0) {
          selectQuery = `*, ${relations.join(', ')}`;
        }
      }
      
      let query = supabase
        .from('purchases')
        .select(selectQuery)
        .limit(1);
      
      // 필터 조건 적용
      if (where) {
        if (where.id) query = query.eq('id', where.id);
        if (where.orderNumber) query = query.eq('order_number', where.orderNumber);
        if (where.buyerId) query = query.eq('buyer_id', where.buyerId);
        if (where.sellerId) query = query.eq('seller_id', where.sellerId);
        if (where.postId) query = query.eq('post_id', where.postId);
        if (where.status) query = query.eq('status', where.status);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase 구매 조회 오류:', error);
        return null;
      }
      
      return data && data.length > 0 ? data[0] : null;
    }
  };
  
  // 연결 해제 함수 (호환성을 위한 더미 함수)
  async $disconnect() {
    console.log('Prisma 호환 래퍼: $disconnect 호출');
    return true;
  }
  
  // 선택 필드 포맷팅
  _formatSelect(select: any): string {
    if (!select) return '*';
    
    const fields = Object.keys(select).filter(key => select[key]);
    if (fields.length === 0) return '*';
    
    return fields.join(',');
  }
}

// 더미 prisma 객체 - 기존 코드의 타입 호환성을 위한 래퍼
// @ts-ignore - 타입 체크 무시
const prisma = new SupabaseWrapper();
export default prisma; 