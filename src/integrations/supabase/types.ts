export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_assistant_settings: {
        Row: {
          daily_user_limit: number
          enabled: boolean
          global_daily_limit: number
          global_monthly_limit: number
          id: number
          monthly_user_limit: number
          new_account_daily_limit: number
          new_account_window_days: number
          new_account_window_limit: number
          owner_daily_limit: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          daily_user_limit?: number
          enabled?: boolean
          global_daily_limit?: number
          global_monthly_limit?: number
          id?: number
          monthly_user_limit?: number
          new_account_daily_limit?: number
          new_account_window_days?: number
          new_account_window_limit?: number
          owner_daily_limit?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          daily_user_limit?: number
          enabled?: boolean
          global_daily_limit?: number
          global_monthly_limit?: number
          id?: number
          monthly_user_limit?: number
          new_account_daily_limit?: number
          new_account_window_days?: number
          new_account_window_limit?: number
          owner_daily_limit?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_assistant_usage: {
        Row: {
          cached: boolean
          id: string
          input_tokens: number | null
          output_tokens: number | null
          provider_error_code: string | null
          request_key: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          cached?: boolean
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          provider_error_code?: string | null
          request_key?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          cached?: boolean
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          provider_error_code?: string | null
          request_key?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      anilist_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          payload?: Json
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          pair_key: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          pair_key: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          pair_key?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          archived_at: string | null
          blocked_at: string | null
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          muted_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          blocked_at?: string | null
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          muted_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          blocked_at?: string | null
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          muted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          reason: string
          reporter_id: string
          resolution_note: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["moderation_target_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["moderation_target_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["moderation_target_type"]
          updated_at?: string
        }
        Relationships: []
      }
      email_delivery_logs: {
        Row: {
          content_version: string | null
          created_at: string
          digest_type: string
          failure_code: string | null
          failure_message_safe: string | null
          id: string
          metadata: Json
          provider: string | null
          provider_message_id: string | null
          recipient_hash: string | null
          recipient_masked: string | null
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          content_version?: string | null
          created_at?: string
          digest_type: string
          failure_code?: string | null
          failure_message_safe?: string | null
          id?: string
          metadata?: Json
          provider?: string | null
          provider_message_id?: string | null
          recipient_hash?: string | null
          recipient_masked?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          content_version?: string | null
          created_at?: string
          digest_type?: string
          failure_code?: string | null
          failure_message_safe?: string | null
          id?: string
          metadata?: Json
          provider?: string | null
          provider_message_id?: string | null
          recipient_hash?: string | null
          recipient_masked?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fiche_reviews: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          media_external_id: string
          media_source: string
          rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          media_external_id: string
          media_source: string
          rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          media_external_id?: string
          media_source?: string
          rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          is_locked: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_locked?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_locked?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          reply_to_id: string | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          reply_to_id?: string | null
          topic_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          reply_to_id?: string | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          reason: string
          reporter_id: string
          resolution_note: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_topics: {
        Row: {
          author_id: string
          body: string
          category_id: string
          cover_image_alt: string | null
          cover_image_path: string | null
          cover_image_source: string | null
          cover_updated_at: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          is_locked: boolean
          is_pinned: boolean
          last_activity_at: string
          reply_count: number
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          category_id: string
          cover_image_alt?: string | null
          cover_image_path?: string | null
          cover_image_source?: string | null
          cover_updated_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          last_activity_at?: string
          reply_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          category_id?: string
          cover_image_alt?: string | null
          cover_image_path?: string | null
          cover_image_source?: string | null
          cover_updated_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          last_activity_at?: string
          reply_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          provider: string
          source_metadata: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          provider: string
          source_metadata?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          provider?: string
          source_metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_items: {
        Row: {
          alt_titles: string[]
          applied_action: string | null
          applied_at: string | null
          batch_id: string
          completed_at: string | null
          created_at: string
          id: string
          import_action: string
          is_rewatching: boolean
          match_confidence: number | null
          match_status: string
          matched_media_key: string | null
          media_snapshot: Json | null
          media_type: string | null
          normalized_title: string | null
          notes: string | null
          previous_item: Json | null
          progress: number | null
          provider: string
          provider_ref: string | null
          raw_title: string
          release_year: number | null
          rewatch_count: number | null
          started_at: string | null
          total_episodes: number | null
          updated_at: string
          user_id: string
          user_score: number | null
          user_status: string | null
          user_tags: string[]
        }
        Insert: {
          alt_titles?: string[]
          applied_action?: string | null
          applied_at?: string | null
          batch_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          import_action?: string
          is_rewatching?: boolean
          match_confidence?: number | null
          match_status?: string
          matched_media_key?: string | null
          media_snapshot?: Json | null
          media_type?: string | null
          normalized_title?: string | null
          notes?: string | null
          previous_item?: Json | null
          progress?: number | null
          provider: string
          provider_ref?: string | null
          raw_title: string
          release_year?: number | null
          rewatch_count?: number | null
          started_at?: string | null
          total_episodes?: number | null
          updated_at?: string
          user_id: string
          user_score?: number | null
          user_status?: string | null
          user_tags?: string[]
        }
        Update: {
          alt_titles?: string[]
          applied_action?: string | null
          applied_at?: string | null
          batch_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          import_action?: string
          is_rewatching?: boolean
          match_confidence?: number | null
          match_status?: string
          matched_media_key?: string | null
          media_snapshot?: Json | null
          media_type?: string | null
          normalized_title?: string | null
          notes?: string | null
          previous_item?: Json | null
          progress?: number | null
          provider?: string
          provider_ref?: string | null
          raw_title?: string
          release_year?: number | null
          rewatch_count?: number | null
          started_at?: string | null
          total_episodes?: number | null
          updated_at?: string
          user_id?: string
          user_score?: number | null
          user_status?: string | null
          user_tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "import_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          completed_at: string | null
          created_at: string
          favorite: boolean
          id: string
          import_provider: string | null
          import_ref: string | null
          is_rewatching: boolean
          media_key: string
          notes: string
          priority: Database["public"]["Enums"]["priority_level"]
          progress: number | null
          rating: number | null
          rewatch_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["watch_status"] | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          favorite?: boolean
          id?: string
          import_provider?: string | null
          import_ref?: string | null
          is_rewatching?: boolean
          media_key: string
          notes?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          progress?: number | null
          rating?: number | null
          rewatch_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["watch_status"] | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          favorite?: boolean
          id?: string
          import_provider?: string | null
          import_ref?: string | null
          is_rewatching?: boolean
          media_key?: string
          notes?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          progress?: number | null
          rating?: number | null
          rewatch_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["watch_status"] | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_media_key_fkey"
            columns: ["media_key"]
            isOneToOne: false
            referencedRelation: "media_records"
            referencedColumns: ["media_key"]
          },
        ]
      }
      media_enrichments: {
        Row: {
          backdrop_url_override: string | null
          created_at: string
          created_by: string | null
          data_quality_status: string
          enrichment_notes: string | null
          external_id: string
          external_links: Json | null
          extra_characters: Json | null
          extra_platforms: Json | null
          extra_relations: Json | null
          extra_sources: Json | null
          extra_staff: Json | null
          extra_titles: Json | null
          id: string
          is_published: boolean
          native_title_override: string | null
          poster_url_override: string | null
          qa_flags: Json | null
          source: string
          status_note: string | null
          synopsis_override: string | null
          title_override: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          backdrop_url_override?: string | null
          created_at?: string
          created_by?: string | null
          data_quality_status?: string
          enrichment_notes?: string | null
          external_id: string
          external_links?: Json | null
          extra_characters?: Json | null
          extra_platforms?: Json | null
          extra_relations?: Json | null
          extra_sources?: Json | null
          extra_staff?: Json | null
          extra_titles?: Json | null
          id?: string
          is_published?: boolean
          native_title_override?: string | null
          poster_url_override?: string | null
          qa_flags?: Json | null
          source: string
          status_note?: string | null
          synopsis_override?: string | null
          title_override?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          backdrop_url_override?: string | null
          created_at?: string
          created_by?: string | null
          data_quality_status?: string
          enrichment_notes?: string | null
          external_id?: string
          external_links?: Json | null
          extra_characters?: Json | null
          extra_platforms?: Json | null
          extra_relations?: Json | null
          extra_sources?: Json | null
          extra_staff?: Json | null
          extra_titles?: Json | null
          id?: string
          is_published?: boolean
          native_title_override?: string | null
          poster_url_override?: string | null
          qa_flags?: Json | null
          source?: string
          status_note?: string | null
          synopsis_override?: string | null
          title_override?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      media_records: {
        Row: {
          backdrop_url: string | null
          created_at: string
          external_id: string
          genres: string[]
          media_key: string
          media_type: string
          platforms: Json
          poster_url: string | null
          release_date: string | null
          score: number | null
          source: string
          title: string
          title_original: string | null
          updated_at: string
        }
        Insert: {
          backdrop_url?: string | null
          created_at?: string
          external_id: string
          genres?: string[]
          media_key: string
          media_type: string
          platforms?: Json
          poster_url?: string | null
          release_date?: string | null
          score?: number | null
          source: string
          title: string
          title_original?: string | null
          updated_at?: string
        }
        Update: {
          backdrop_url?: string | null
          created_at?: string
          external_id?: string
          genres?: string[]
          media_key?: string
          media_type?: string
          platforms?: Json
          poster_url?: string | null
          release_date?: string | null
          score?: number | null
          source?: string
          title?: string
          title_original?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      media_requests: {
        Row: {
          created_at: string
          external_url: string
          id: string
          media_type: string
          note: string
          requester_id: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_url?: string
          id?: string
          media_type: string
          note?: string
          requester_id: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_url?: string
          id?: string
          media_type?: string
          note?: string
          requester_id?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_email_preferences: {
        Row: {
          consent_updated_at: string
          created_at: string
          digest_frequency: string
          include_articles: boolean
          include_recommendations: boolean
          include_upcoming: boolean
          last_digest_preview_at: string | null
          preferred_content_types: string[]
          preferred_genres: string[] | null
          preferred_platforms: string[] | null
          receive_general_digest: boolean
          receive_personalized_digest: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_updated_at?: string
          created_at?: string
          digest_frequency?: string
          include_articles?: boolean
          include_recommendations?: boolean
          include_upcoming?: boolean
          last_digest_preview_at?: string | null
          preferred_content_types?: string[]
          preferred_genres?: string[] | null
          preferred_platforms?: string[] | null
          receive_general_digest?: boolean
          receive_personalized_digest?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_updated_at?: string
          created_at?: string
          digest_frequency?: string
          include_articles?: boolean
          include_recommendations?: boolean
          include_upcoming?: boolean
          last_digest_preview_at?: string | null
          preferred_content_types?: string[]
          preferred_genres?: string[] | null
          preferred_platforms?: string[] | null
          receive_general_digest?: boolean
          receive_personalized_digest?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_notification_preferences: {
        Row: {
          created_at: string
          forum_mention_enabled: boolean
          forum_moderation_enabled: boolean
          forum_reply_enabled: boolean
          new_episode_enabled: boolean
          quiet_mode: boolean
          recommendation_enabled: boolean
          related_article_enabled: boolean
          shared_list_enabled: boolean
          snooze_until: string | null
          system_notice_enabled: boolean
          upcoming_release_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          forum_mention_enabled?: boolean
          forum_moderation_enabled?: boolean
          forum_reply_enabled?: boolean
          new_episode_enabled?: boolean
          quiet_mode?: boolean
          recommendation_enabled?: boolean
          related_article_enabled?: boolean
          shared_list_enabled?: boolean
          snooze_until?: string | null
          system_notice_enabled?: boolean
          upcoming_release_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          forum_mention_enabled?: boolean
          forum_moderation_enabled?: boolean
          forum_reply_enabled?: boolean
          new_episode_enabled?: boolean
          quiet_mode?: boolean
          recommendation_enabled?: boolean
          related_article_enabled?: boolean
          shared_list_enabled?: boolean
          snooze_until?: string | null
          system_notice_enabled?: boolean
          upcoming_release_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_notifications: {
        Row: {
          article_slug: string | null
          created_at: string
          destination_url: string
          dismissed_at: string | null
          event_key: string
          expires_at: string | null
          id: string
          media_external_id: string | null
          media_source: string | null
          message: string
          metadata: Json
          notification_type: string
          occurred_at: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          article_slug?: string | null
          created_at?: string
          destination_url: string
          dismissed_at?: string | null
          event_key: string
          expires_at?: string | null
          id?: string
          media_external_id?: string | null
          media_source?: string | null
          message: string
          metadata?: Json
          notification_type: string
          occurred_at?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          article_slug?: string | null
          created_at?: string
          destination_url?: string
          dismissed_at?: string | null
          event_key?: string
          expires_at?: string | null
          id?: string
          media_external_id?: string | null
          media_source?: string | null
          message?: string
          metadata?: Json
          notification_type?: string
          occurred_at?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action_type"]
          actor_id: string
          created_at: string
          id: string
          note: string
          reason: string
          report_id: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["moderation_target_type"]
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action_type"]
          actor_id: string
          created_at?: string
          id?: string
          note?: string
          reason?: string
          report_id?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["moderation_target_type"]
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action_type"]
          actor_id?: string
          created_at?: string
          id?: string
          note?: string
          reason?: string
          report_id?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["moderation_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          playlist_id: string
          role: Database["public"]["Enums"]["playlist_collab_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          playlist_id: string
          role?: Database["public"]["Enums"]["playlist_collab_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          playlist_id?: string
          role?: Database["public"]["Enums"]["playlist_collab_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_collaborators_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          media_key: string
          note: string
          playlist_id: string
          position: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          media_key: string
          note?: string
          playlist_id: string
          position?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          media_key?: string
          note?: string
          playlist_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_media_key_fkey"
            columns: ["media_key"]
            isOneToOne: false
            referencedRelation: "media_records"
            referencedColumns: ["media_key"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_likes: {
        Row: {
          created_at: string
          id: string
          playlist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          playlist_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          playlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_likes_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string
          playlist_id: string
          requester_id: string
          status: Database["public"]["Enums"]["playlist_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string
          playlist_id: string
          requester_id: string
          status?: Database["public"]["Enums"]["playlist_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string
          playlist_id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["playlist_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_requests_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          is_public: boolean
          owner_id: string
          recommendation: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_public?: boolean
          owner_id: string
          recommendation?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_public?: boolean
          owner_id?: string
          recommendation?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepts_chat: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          favorite_styles: string[]
          id: string
          preferred_genres: string[]
          preferred_types: string[]
          updated_at: string
        }
        Insert: {
          accepts_chat?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          favorite_styles?: string[]
          id: string
          preferred_genres?: string[]
          preferred_types?: string[]
          updated_at?: string
        }
        Update: {
          accepts_chat?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          favorite_styles?: string[]
          id?: string
          preferred_genres?: string[]
          preferred_types?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      public_badges: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          icon_key: string | null
          id: string
          is_active: boolean
          label: string
          updated_at: string
          visual_variant: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          icon_key?: string | null
          id?: string
          is_active?: boolean
          label: string
          updated_at?: string
          visual_variant?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          icon_key?: string | null
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
          visual_variant?: string
        }
        Relationships: []
      }
      recommendation_feedback: {
        Row: {
          action: string
          created_at: string
          id: string
          media_key: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          media_key: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          media_key?: string
          user_id?: string
        }
        Relationships: []
      }
      reply_likes: {
        Row: {
          created_at: string
          id: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reply_likes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "review_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "fiche_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_replies: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "fiche_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_playlist_reviews: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          playlist_id: string
          rating: number | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          playlist_id: string
          rating?: number | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          playlist_id?: string
          rating?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_playlist_reviews_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_public_badges: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          badge_id: string
          id: string
          is_visible: boolean
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          badge_id: string
          id?: string
          is_visible?: boolean
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          badge_id?: string
          id?: string
          is_visible?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_public_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "public_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_recap_reads: {
        Row: {
          created_at: string
          id: string
          read_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          read_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          read_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_conversation: { Args: { _id: string }; Returns: undefined }
      ai_assistant_admin_stats: { Args: never; Returns: Json }
      ai_assistant_finalize: {
        Args: {
          _error_code?: string
          _input_tokens?: number
          _output_tokens?: number
          _status: string
          _usage_id: string
        }
        Returns: undefined
      }
      ai_assistant_my_quota: { Args: never; Returns: Json }
      ai_assistant_reserve: { Args: { _request_key: string }; Returns: Json }
      ai_assistant_update_settings: { Args: { _patch: Json }; Returns: Json }
      anilist_cache_get: {
        Args: { p_key: string }
        Returns: {
          fetched_at: string
          payload: Json
        }[]
      }
      anilist_cache_put: {
        Args: { p_key: string; p_payload: Json; p_token: string }
        Returns: undefined
      }
      archive_conversation: {
        Args: { _archived?: boolean; _id: string }
        Returns: undefined
      }
      block_chat_member: {
        Args: { _blocked?: boolean; _id: string }
        Returns: undefined
      }
      can_moderate_now: { Args: { _user_id: string }; Returns: boolean }
      can_view_playlist: {
        Args: { _playlist: string; _user: string }
        Returns: boolean
      }
      chat_pair_key: { Args: { _a: string; _b: string }; Returns: string }
      create_forum_post: {
        Args: { _body: string; _reply_to?: string; _topic: string }
        Returns: string
      }
      create_forum_topic: {
        Args: { _body: string; _category: string; _title: string }
        Returns: string
      }
      create_system_notice: {
        Args: {
          _destination_url?: string
          _expires_at?: string
          _message: string
          _target?: string
          _title: string
        }
        Returns: string
      }
      decide_playlist_request: {
        Args: { _accept: boolean; _request: string }
        Returns: undefined
      }
      decline_conversation: { Args: { _id: string }; Returns: undefined }
      delete_chat_message: { Args: { _id: string }; Returns: undefined }
      delete_forum_post: { Args: { _id: string }; Returns: undefined }
      delete_forum_topic: { Args: { _id: string }; Returns: undefined }
      delete_playlist_review: { Args: { _id: string }; Returns: undefined }
      edit_chat_message: {
        Args: { _body: string; _id: string }
        Returns: undefined
      }
      edit_forum_post: {
        Args: { _body: string; _id: string }
        Returns: undefined
      }
      edit_forum_topic: {
        Args: { _body: string; _id: string; _title: string }
        Returns: undefined
      }
      forum_notify: {
        Args: {
          _event_key: string
          _message: string
          _title: string
          _type: string
          _url: string
          _user: string
        }
        Returns: undefined
      }
      founder_user_ids: { Args: never; Returns: string[] }
      get_my_profile: {
        Args: never
        Returns: {
          accepts_chat: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          favorite_styles: string[]
          id: string
          preferred_genres: string[]
          preferred_types: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_enrichment: {
        Args: { _external_id: string; _source: string }
        Returns: {
          backdrop_url_override: string
          data_quality_status: string
          external_id: string
          external_links: Json
          extra_characters: Json
          extra_platforms: Json
          extra_relations: Json
          extra_sources: Json
          extra_staff: Json
          extra_titles: Json
          native_title_override: string
          poster_url_override: string
          source: string
          status_note: string
          synopsis_override: string
          title_override: string
        }[]
      }
      grant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chat_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_playlist_collaborator: {
        Args: { _playlist: string; _user: string }
        Returns: boolean
      }
      is_playlist_editor: {
        Args: { _playlist: string; _user: string }
        Returns: boolean
      }
      manage_forum_category: {
        Args: {
          _description: string
          _icon: string
          _id: string
          _is_locked: boolean
          _name: string
          _slug: string
          _sort_order: number
        }
        Returns: string
      }
      mark_conversation_read: { Args: { _id: string }; Returns: undefined }
      moderate_clear_forum_cover: {
        Args: { _note?: string; _topic: string }
        Returns: string
      }
      moderate_content: {
        Args: {
          _action: Database["public"]["Enums"]["moderation_action_type"]
          _note?: string
          _reason?: string
          _report_id?: string
          _target_id: string
          _target_type: Database["public"]["Enums"]["moderation_target_type"]
        }
        Returns: undefined
      }
      moderate_forum: {
        Args: {
          _action: string
          _note?: string
          _target_id: string
          _target_type: string
        }
        Returns: undefined
      }
      moderation_chat_context: {
        Args: { _message: string }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string
          edited_at: string
          hidden_at: string
          id: string
          is_target: boolean
          sender_id: string
        }[]
      }
      my_moderation_access: {
        Args: never
        Returns: {
          can_moderate: boolean
          is_owner: boolean
        }[]
      }
      notify_member: {
        Args: {
          _event_key: string
          _message: string
          _title: string
          _type: string
          _url: string
          _user: string
        }
        Returns: undefined
      }
      reco_feedback_stats: {
        Args: never
        Returns: {
          action: string
          distinct_media: number
          total: number
        }[]
      }
      report_chat_message: {
        Args: { _details?: string; _id: string; _reason: string }
        Returns: string
      }
      request_conversation: { Args: { _target: string }; Returns: string }
      request_playlist_join: {
        Args: { _message?: string; _playlist: string }
        Returns: string
      }
      resolve_forum_report: {
        Args: { _id: string; _note?: string; _status: string }
        Returns: undefined
      }
      resolve_report: {
        Args: {
          _note?: string
          _report_id: string
          _status: Database["public"]["Enums"]["report_status"]
        }
        Returns: undefined
      }
      revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      role_rank: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      send_chat_message: {
        Args: { _body: string; _conv: string }
        Returns: string
      }
      set_forum_topic_cover: {
        Args: { _alt?: string; _path: string; _source?: string; _topic: string }
        Returns: undefined
      }
      submit_content_report: {
        Args: {
          _details?: string
          _reason: string
          _target_id: string
          _target_type: Database["public"]["Enums"]["moderation_target_type"]
        }
        Returns: string
      }
      submit_forum_report: {
        Args: {
          _details?: string
          _reason: string
          _target_id: string
          _target_type: string
        }
        Returns: string
      }
      upsert_playlist_review: {
        Args: { _body: string; _playlist: string; _rating?: number }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "moderator"
        | "editorial_contributor"
        | "trusted_member"
        | "member"
      moderation_action_type:
        | "hide"
        | "unhide"
        | "soft_delete"
        | "restore"
        | "lock"
        | "unlock"
        | "warn"
        | "timeout"
        | "dismiss_report"
      moderation_target_type:
        | "review"
        | "reply"
        | "playlist"
        | "playlist_item"
        | "playlist_review"
        | "chat_message"
      playlist_collab_role: "viewer" | "editor"
      playlist_request_status: "pending" | "accepted" | "declined" | "cancelled"
      priority_level: "basse" | "normale" | "haute"
      report_status: "pending" | "reviewing" | "dismissed" | "action_taken"
      watch_status: "a_voir" | "en_cours" | "termine" | "en_pause" | "abandonne"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "admin",
        "moderator",
        "editorial_contributor",
        "trusted_member",
        "member",
      ],
      moderation_action_type: [
        "hide",
        "unhide",
        "soft_delete",
        "restore",
        "lock",
        "unlock",
        "warn",
        "timeout",
        "dismiss_report",
      ],
      moderation_target_type: [
        "review",
        "reply",
        "playlist",
        "playlist_item",
        "playlist_review",
        "chat_message",
      ],
      playlist_collab_role: ["viewer", "editor"],
      playlist_request_status: ["pending", "accepted", "declined", "cancelled"],
      priority_level: ["basse", "normale", "haute"],
      report_status: ["pending", "reviewing", "dismissed", "action_taken"],
      watch_status: ["a_voir", "en_cours", "termine", "en_pause", "abandonne"],
    },
  },
} as const
