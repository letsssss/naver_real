-- Enable RLS on messages table
alter table public.messages enable row level security;

-- Allow room participants to insert messages
create policy "Room participants can insert messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid() AND  -- Ensure message is created by authenticated user
  exists (
    select 1 from room_participants
    where room_id = messages.room_id 
    and profile_id = auth.uid()
  )
);

-- Allow room participants to view messages
create policy "Room participants can view messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1 from room_participants
    where room_id = messages.room_id 
    and profile_id = auth.uid()
  )
);

-- Enable RLS on rooms table
alter table public.rooms enable row level security;

-- Allow room participants to view rooms
create policy "Room participants can view their rooms"
on public.rooms
for select 
to authenticated
using (
  exists (
    select 1 from room_participants
    where room_id = rooms.id
    and profile_id = auth.uid()
  )
);

-- Allow authenticated users to create rooms
create policy "Authenticated users can create rooms"
on public.rooms
for insert
to authenticated
with check (true);

-- Enable RLS on room_participants table
alter table public.room_participants enable row level security;

-- Allow participants to view other participants in their rooms
create policy "Room participants can view other participants"
on public.room_participants
for select
to authenticated 
using (
  exists (
    select 1 from room_participants
    where room_id = room_participants.room_id
    and profile_id = auth.uid()
  )
);

-- Allow creating room participants through the create_new_room function
create policy "Allow creating room participants"
on public.room_participants
for insert
to authenticated
with check (
  profile_id = auth.uid() OR  -- User can add themselves
  exists (  -- Or the room was just created by this user
    select 1 from rooms r
    where r.id = room_id
    and exists (
      select 1 from room_participants
      where room_id = r.id
      and profile_id = auth.uid()
      and created_at >= now() - interval '5 seconds'
    )
  )
);

-- Enable RLS on profiles table
alter table public.profiles enable row level security;

-- Allow users to view all profiles (needed for displaying user info in chat)
create policy "Profiles are viewable by all authenticated users"
on public.profiles
for select
to authenticated
using (true);

-- Allow users to update their own profile
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Allow users to insert their own profile
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid()); 