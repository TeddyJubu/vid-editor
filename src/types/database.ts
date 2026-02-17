export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workspace_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          format_preset: string;
          current_version_id: string | null;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          format_preset: string;
          current_version_id?: string | null;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          title?: string;
          format_preset?: string;
          current_version_id?: string | null;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      project_versions: {
        Row: {
          id: string;
          project_id: string;
          project_json: Json;
          label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          project_json: Json;
          label?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          project_json?: Json;
          label?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          filename: string;
          storage_key: string;
          mime_type: string;
          size_bytes: number;
          duration_seconds: number | null;
          width: number | null;
          height: number | null;
          thumbnail_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          filename: string;
          storage_key: string;
          mime_type: string;
          size_bytes: number;
          duration_seconds?: number | null;
          width?: number | null;
          height?: number | null;
          thumbnail_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          project_id?: string;
          filename?: string;
          storage_key?: string;
          mime_type?: string;
          size_bytes?: number;
          duration_seconds?: number | null;
          width?: number | null;
          height?: number | null;
          thumbnail_key?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      render_jobs: {
        Row: {
          id: string;
          workspace_id: string;
          project_version_id: string;
          tier: string;
          duration_seconds: number;
          width: number;
          height: number;
          fps: number;
          estimated_ru: number;
          actual_ru: number | null;
          status: string;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_version_id: string;
          tier: string;
          duration_seconds: number;
          width: number;
          height: number;
          fps: number;
          estimated_ru: number;
          actual_ru?: number | null;
          status: string;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          project_version_id?: string;
          tier?: string;
          duration_seconds?: number;
          width?: number;
          height?: number;
          fps?: number;
          estimated_ru?: number;
          actual_ru?: number | null;
          status?: string;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      render_outputs: {
        Row: {
          id: string;
          render_job_id: string;
          storage_key: string;
          format: string;
          size_bytes: number;
          share_token: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          render_job_id: string;
          storage_key: string;
          format: string;
          size_bytes: number;
          share_token: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          render_job_id?: string;
          storage_key?: string;
          format?: string;
          size_bytes?: number;
          share_token?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      credit_ledgers: {
        Row: {
          id: string;
          workspace_id: string;
          balance_ru: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          balance_ru?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          balance_ru?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      credit_events: {
        Row: {
          id: string;
          credit_ledger_id: string;
          type: string;
          delta_ru: number;
          render_job_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          credit_ledger_id: string;
          type: string;
          delta_ru: number;
          render_job_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          credit_ledger_id?: string;
          type?: string;
          delta_ru?: number;
          render_job_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          workspace_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          status: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          stripe_price_id?: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
