ALTER TABLE public.member_notifications
  DROP CONSTRAINT member_notifications_notification_type_check;

ALTER TABLE public.member_notifications
  ADD CONSTRAINT member_notifications_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'new_episode'::text,
    'upcoming_release'::text,
    'related_article'::text,
    'personalized_recommendation'::text,
    'shared_list_request'::text,
    'shared_list_request_accepted'::text,
    'shared_list_request_declined'::text,
    'system_notice'::text,
    'forum_reply'::text,
    'forum_mention'::text,
    'forum_moderation'::text,
    'chat_request'::text,
    'chat_request_accepted'::text,
    'chat_message'::text,
    'playlist_review'::text
  ]));