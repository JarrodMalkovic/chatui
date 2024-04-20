# Supabase RLS Policies Documentation

This document outlines the Row Level Security (RLS) policies applied to the tables within our Supabase database. Each policy ensures that users can only access and manipulate their own data.

## `select_own_data` on `conversations`
Allows users to select their own data from the conversations.

**SQL Statement:**
```sql
CREATE POLICY select_own_data ON conversations
FOR SELECT
USING (user_id = auth.uid());
```

## `insert_for_authenticated_users` on `conversations`
Allows any authenticated users to insert into the conversations table.

**SQL Statement:**
```sql
CREATE POLICY insert_for_authenticated_users ON conversations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
```

## `update_own_data` on `conversations`
Allows users to update their own records in the conversations table.

**SQL Statement:**
```sql
CREATE POLICY update_own_data ON conversations
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

## `insert_user_id_policy` on `conversations`
Ensures that the user inserting a record into conversations is the authenticated user.

**SQL Statement:**
```sql
CREATE POLICY insert_user_id_policy ON conversations
FOR INSERT
WITH CHECK (user_id = auth.uid());
```

## `select_messages` on `messages`
Allows users to select messages where they are part of the conversation.

**SQL Statement:**
```sql
CREATE POLICY select_messages ON messages
USING (
    EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
);
```

## `insert_messages` on `messages`
Allows users to insert messages only if they are part of the conversation.

**SQL Statement:**
```sql
CREATE POLICY insert_messages ON messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
);
```

## `delete_conversation` on `public.conversations`
Allows users to delete their own conversations.

**SQL Statement:**
```sql
CREATE POLICY delete_conversation ON public.conversations
FOR DELETE USING (
    auth.uid() = user_id
);
```
