CREATE POLICY select_own_data ON conversations
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY insert_for_authenticated_users ON conversations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY update_own_data ON conversations
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY insert_user_id_policy ON conversations
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY select_messages ON messages
USING (
    EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
);

CREATE POLICY insert_messages ON messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
);

CREATE POLICY delete_conversation ON public.conversations
FOR DELETE USING (
    auth.uid() = user_id
);