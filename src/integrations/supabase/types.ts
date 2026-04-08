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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_messages: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          message: string
          subject: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          message: string
          subject?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          message?: string
          subject?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          details: Json | null
          id: string
          loan_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          loan_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          loan_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chama_announcements: {
        Row: {
          created_at: string
          group_id: string
          id: string
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          message: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_groups: {
        Row: {
          allow_early_withdrawal: boolean | null
          allow_partial_contributions: boolean | null
          annual_savings_target: number | null
          auto_remove_after_missed: number | null
          chairperson_can_remove_members: boolean | null
          contribution_amount: number
          contribution_frequency: string
          contribution_rollover_enabled: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          dissolution_policy: string | null
          dividend_distribution_frequency: string | null
          early_withdrawal_penalty: number | null
          emergency_fund_enabled: boolean | null
          emergency_fund_percentage: number | null
          grace_period_days: number | null
          group_registration_number: string | null
          harambee_enabled: boolean | null
          id: string
          investment_enabled: boolean | null
          investment_types: string | null
          is_public: boolean
          joining_fee: number | null
          late_contribution_penalty: number | null
          late_penalty_amount: number | null
          late_penalty_enabled: boolean | null
          late_penalty_type: string | null
          loan_enabled: boolean | null
          loan_insurance_percentage: number | null
          loan_interest_rate: number | null
          loan_max_amount: number | null
          loan_max_duration_months: number | null
          loan_processing_fee: number | null
          lock_period_months: number | null
          max_loan_multiplier: number | null
          max_members: number | null
          max_withdrawal_per_month: number | null
          meeting_absence_penalty: number | null
          meeting_day: string | null
          meeting_frequency: string | null
          merry_go_round_enabled: boolean | null
          min_balance_required: number | null
          min_contribution_amount: number | null
          min_savings_before_loan: number | null
          name: string
          new_member_probation_months: number | null
          notification_meeting_reminder: boolean | null
          notification_savings_reminder: boolean | null
          order_number: string | null
          profile_image_url: string | null
          profit_sharing_method: string | null
          quorum_percentage: number | null
          refund_percentage: number | null
          refund_policy: string | null
          require_backdated_savings: boolean | null
          require_guarantor_for_loans: boolean | null
          share_transfer_allowed: boolean | null
          special_contribution_enabled: boolean | null
          terms: string | null
          terms_updated_at: string | null
          voting_required_for: string | null
          welfare_fund_amount: number | null
          welfare_fund_enabled: boolean | null
        }
        Insert: {
          allow_early_withdrawal?: boolean | null
          allow_partial_contributions?: boolean | null
          annual_savings_target?: number | null
          auto_remove_after_missed?: number | null
          chairperson_can_remove_members?: boolean | null
          contribution_amount?: number
          contribution_frequency?: string
          contribution_rollover_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dissolution_policy?: string | null
          dividend_distribution_frequency?: string | null
          early_withdrawal_penalty?: number | null
          emergency_fund_enabled?: boolean | null
          emergency_fund_percentage?: number | null
          grace_period_days?: number | null
          group_registration_number?: string | null
          harambee_enabled?: boolean | null
          id?: string
          investment_enabled?: boolean | null
          investment_types?: string | null
          is_public?: boolean
          joining_fee?: number | null
          late_contribution_penalty?: number | null
          late_penalty_amount?: number | null
          late_penalty_enabled?: boolean | null
          late_penalty_type?: string | null
          loan_enabled?: boolean | null
          loan_insurance_percentage?: number | null
          loan_interest_rate?: number | null
          loan_max_amount?: number | null
          loan_max_duration_months?: number | null
          loan_processing_fee?: number | null
          lock_period_months?: number | null
          max_loan_multiplier?: number | null
          max_members?: number | null
          max_withdrawal_per_month?: number | null
          meeting_absence_penalty?: number | null
          meeting_day?: string | null
          meeting_frequency?: string | null
          merry_go_round_enabled?: boolean | null
          min_balance_required?: number | null
          min_contribution_amount?: number | null
          min_savings_before_loan?: number | null
          name: string
          new_member_probation_months?: number | null
          notification_meeting_reminder?: boolean | null
          notification_savings_reminder?: boolean | null
          order_number?: string | null
          profile_image_url?: string | null
          profit_sharing_method?: string | null
          quorum_percentage?: number | null
          refund_percentage?: number | null
          refund_policy?: string | null
          require_backdated_savings?: boolean | null
          require_guarantor_for_loans?: boolean | null
          share_transfer_allowed?: boolean | null
          special_contribution_enabled?: boolean | null
          terms?: string | null
          terms_updated_at?: string | null
          voting_required_for?: string | null
          welfare_fund_amount?: number | null
          welfare_fund_enabled?: boolean | null
        }
        Update: {
          allow_early_withdrawal?: boolean | null
          allow_partial_contributions?: boolean | null
          annual_savings_target?: number | null
          auto_remove_after_missed?: number | null
          chairperson_can_remove_members?: boolean | null
          contribution_amount?: number
          contribution_frequency?: string
          contribution_rollover_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dissolution_policy?: string | null
          dividend_distribution_frequency?: string | null
          early_withdrawal_penalty?: number | null
          emergency_fund_enabled?: boolean | null
          emergency_fund_percentage?: number | null
          grace_period_days?: number | null
          group_registration_number?: string | null
          harambee_enabled?: boolean | null
          id?: string
          investment_enabled?: boolean | null
          investment_types?: string | null
          is_public?: boolean
          joining_fee?: number | null
          late_contribution_penalty?: number | null
          late_penalty_amount?: number | null
          late_penalty_enabled?: boolean | null
          late_penalty_type?: string | null
          loan_enabled?: boolean | null
          loan_insurance_percentage?: number | null
          loan_interest_rate?: number | null
          loan_max_amount?: number | null
          loan_max_duration_months?: number | null
          loan_processing_fee?: number | null
          lock_period_months?: number | null
          max_loan_multiplier?: number | null
          max_members?: number | null
          max_withdrawal_per_month?: number | null
          meeting_absence_penalty?: number | null
          meeting_day?: string | null
          meeting_frequency?: string | null
          merry_go_round_enabled?: boolean | null
          min_balance_required?: number | null
          min_contribution_amount?: number | null
          min_savings_before_loan?: number | null
          name?: string
          new_member_probation_months?: number | null
          notification_meeting_reminder?: boolean | null
          notification_savings_reminder?: boolean | null
          order_number?: string | null
          profile_image_url?: string | null
          profit_sharing_method?: string | null
          quorum_percentage?: number | null
          refund_percentage?: number | null
          refund_policy?: string | null
          require_backdated_savings?: boolean | null
          require_guarantor_for_loans?: boolean | null
          share_transfer_allowed?: boolean | null
          special_contribution_enabled?: boolean | null
          terms?: string | null
          terms_updated_at?: string | null
          voting_required_for?: string | null
          welfare_fund_amount?: number | null
          welfare_fund_enabled?: boolean | null
        }
        Relationships: []
      }
      chama_harambee_contributions: {
        Row: {
          amount: number
          contributor_name: string | null
          created_at: string
          harambee_id: string
          id: string
          stk_reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          contributor_name?: string | null
          created_at?: string
          harambee_id: string
          id?: string
          stk_reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          contributor_name?: string | null
          created_at?: string
          harambee_id?: string
          id?: string
          stk_reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_harambee_contributions_harambee_id_fkey"
            columns: ["harambee_id"]
            isOneToOne: false
            referencedRelation: "chama_harambees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_harambee"
            columns: ["harambee_id"]
            isOneToOne: false
            referencedRelation: "chama_harambees"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_harambees: {
        Row: {
          beneficiary_name: string | null
          beneficiary_phone: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          group_id: string
          id: string
          image_urls: Json | null
          is_public: boolean
          order_number: string | null
          raised_amount: number
          status: string
          target_amount: number
          title: string
        }
        Insert: {
          beneficiary_name?: string | null
          beneficiary_phone?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          group_id: string
          id?: string
          image_urls?: Json | null
          is_public?: boolean
          order_number?: string | null
          raised_amount?: number
          status?: string
          target_amount?: number
          title: string
        }
        Update: {
          beneficiary_name?: string | null
          beneficiary_phone?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          group_id?: string
          id?: string
          image_urls?: Json | null
          is_public?: boolean
          order_number?: string | null
          raised_amount?: number
          status?: string
          target_amount?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_harambees_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_join_requests: {
        Row: {
          chairperson_decision: string | null
          created_at: string
          decided_by: string | null
          decision_date: string | null
          group_id: string
          id: string
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          chairperson_decision?: string | null
          created_at?: string
          decided_by?: string | null
          decision_date?: string | null
          group_id: string
          id?: string
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          chairperson_decision?: string | null
          created_at?: string
          decided_by?: string | null
          decision_date?: string | null
          group_id?: string
          id?: string
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_joining_fees: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_joining_fees_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_leave_requests: {
        Row: {
          created_at: string
          group_id: string
          id: string
          reason: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          reason?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          reason?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_leave_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_loans: {
        Row: {
          amount: number
          approved_by: string | null
          borrower_id: string | null
          chairperson_decision: string | null
          created_at: string
          decision_date: string | null
          disbursed_at: string | null
          due_date: string | null
          duration_months: number | null
          group_id: string
          id: string
          interest_paid: number | null
          interest_rate: number
          last_payment_date: string | null
          loan_type: string | null
          outstanding_balance: number | null
          principal_paid: number | null
          reason: string | null
          reject_reason: string | null
          rejection_reason: string | null
          repaid_amount: number
          status: string
          total_repayment: number | null
          user_id: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          borrower_id?: string | null
          chairperson_decision?: string | null
          created_at?: string
          decision_date?: string | null
          disbursed_at?: string | null
          due_date?: string | null
          duration_months?: number | null
          group_id: string
          id?: string
          interest_paid?: number | null
          interest_rate?: number
          last_payment_date?: string | null
          loan_type?: string | null
          outstanding_balance?: number | null
          principal_paid?: number | null
          reason?: string | null
          reject_reason?: string | null
          rejection_reason?: string | null
          repaid_amount?: number
          status?: string
          total_repayment?: number | null
          user_id?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          borrower_id?: string | null
          chairperson_decision?: string | null
          created_at?: string
          decision_date?: string | null
          disbursed_at?: string | null
          due_date?: string | null
          duration_months?: number | null
          group_id?: string
          id?: string
          interest_paid?: number | null
          interest_rate?: number
          last_payment_date?: string | null
          loan_type?: string | null
          outstanding_balance?: number | null
          principal_paid?: number | null
          reason?: string | null
          reject_reason?: string | null
          rejection_reason?: string | null
          repaid_amount?: number
          status?: string
          total_repayment?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_loans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_meeting_attendance: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "chama_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_meetings: {
        Row: {
          agenda: string | null
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          meeting_date: string
          minutes: string | null
          status: string
          title: string
          venue: string | null
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          meeting_date: string
          minutes?: string | null
          status?: string
          title: string
          venue?: string | null
        }
        Update: {
          agenda?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          meeting_date?: string
          minutes?: string | null
          status?: string
          title?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chama_meetings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_member_removal_requests: {
        Row: {
          created_at: string
          group_id: string
          id: string
          member_id: string
          reason: string | null
          requested_by: string
          status: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          member_id: string
          reason?: string | null
          requested_by: string
          status?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          member_id?: string
          reason?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_member_removal_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_members: {
        Row: {
          added_by: string | null
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_messages: {
        Row: {
          created_at: string
          group_id: string
          id: string
          message: string
          sender_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          message: string
          sender_name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          message?: string
          sender_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_penalties: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
          is_paid: boolean
          reason: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          group_id: string
          id?: string
          is_paid?: boolean
          reason?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          is_paid?: boolean
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_penalties_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_platform_fees: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          amount: number
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_platform_fees_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_savings: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
          month: string | null
          stk_reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          group_id: string
          id?: string
          month?: string | null
          stk_reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          month?: string | null
          stk_reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_savings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_support_messages: {
        Row: {
          created_at: string
          file_name: string | null
          file_url: string | null
          group_id: string
          id: string
          is_read: boolean
          message: string
          message_type: string | null
          receiver_id: string | null
          sender_id: string | null
          sender_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          group_id: string
          id?: string
          is_read?: boolean
          message: string
          message_type?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          sender_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          group_id?: string
          id?: string
          is_read?: boolean
          message?: string
          message_type?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          sender_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_support_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_term_signatures: {
        Row: {
          group_id: string
          id: string
          signed_at: string
          terms_version: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          signed_at?: string
          terms_version?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          signed_at?: string
          terms_version?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_term_signatures_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_vote_responses: {
        Row: {
          created_at: string
          id: string
          selected_option: string
          user_id: string
          vote_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          selected_option: string
          user_id: string
          vote_id: string
        }
        Update: {
          created_at?: string
          id?: string
          selected_option?: string
          user_id?: string
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_vote_responses_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "chama_votes"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_votes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          group_id: string
          id: string
          options: Json
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          group_id: string
          id?: string
          options?: Json
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string
          id?: string
          options?: Json
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chama_votes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_withdrawal_approvals: {
        Row: {
          approved: boolean | null
          created_at: string
          id: string
          user_id: string
          withdrawal_id: string
        }
        Insert: {
          approved?: boolean | null
          created_at?: string
          id?: string
          user_id: string
          withdrawal_id: string
        }
        Update: {
          approved?: boolean | null
          created_at?: string
          id?: string
          user_id?: string
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_withdrawal_approvals_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "chama_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      chama_withdrawals: {
        Row: {
          admin_reason: string | null
          amount: number
          created_at: string
          group_id: string
          id: string
          reason: string | null
          requested_by: string
          status: string
        }
        Insert: {
          admin_reason?: string | null
          amount: number
          created_at?: string
          group_id: string
          id?: string
          reason?: string | null
          requested_by: string
          status?: string
        }
        Update: {
          admin_reason?: string | null
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          reason?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chama_withdrawals_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          admin_message: string | null
          applied_amount: number
          business_sector: string | null
          created_at: string
          education_level: string | null
          employment_status: string
          existing_loan_amount: number | null
          existing_loans: boolean | null
          generated_limit: number
          id: string
          loan_type: string
          monthly_expenses: number
          monthly_income: number
          next_of_kin_name: string
          next_of_kin_phone: string
          number_of_dependents: number | null
          status: string
          user_id: string
        }
        Insert: {
          admin_message?: string | null
          applied_amount: number
          business_sector?: string | null
          created_at?: string
          education_level?: string | null
          employment_status?: string
          existing_loan_amount?: number | null
          existing_loans?: boolean | null
          generated_limit?: number
          id?: string
          loan_type: string
          monthly_expenses?: number
          monthly_income?: number
          next_of_kin_name?: string
          next_of_kin_phone?: string
          number_of_dependents?: number | null
          status?: string
          user_id: string
        }
        Update: {
          admin_message?: string | null
          applied_amount?: number
          business_sector?: string | null
          created_at?: string
          education_level?: string | null
          employment_status?: string
          existing_loan_amount?: number | null
          existing_loans?: boolean | null
          generated_limit?: number
          id?: string
          loan_type?: string
          monthly_expenses?: number
          monthly_income?: number
          next_of_kin_name?: string
          next_of_kin_phone?: string
          number_of_dependents?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      loan_disbursements: {
        Row: {
          created_at: string
          disbursed_amount: number
          disbursed_at: string
          id: string
          interest_rate: number
          loan_id: string
          monthly_repayment: number
          outstanding_balance: number
          repayment_due_date: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disbursed_amount: number
          disbursed_at?: string
          id?: string
          interest_rate?: number
          loan_id: string
          monthly_repayment?: number
          outstanding_balance: number
          repayment_due_date?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disbursed_amount?: number
          disbursed_at?: string
          id?: string
          interest_rate?: number
          loan_id?: string
          monthly_repayment?: number
          outstanding_balance?: number
          repayment_due_date?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_disbursements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      money_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string | null
          requested_from_id: string
          requested_from_name: string | null
          requester_id: string
          requester_name: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string | null
          requested_from_id: string
          requested_from_name?: string | null
          requester_id: string
          requester_name?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string | null
          requested_from_id?: string
          requested_from_name?: string | null
          requester_id?: string
          requester_name?: string | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personal_savings: {
        Row: {
          created_at: string
          id: string
          interest_rate: number
          maturity_date: string
          name: string
          saved_amount: number
          start_date: string
          status: string
          target_amount: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_rate?: number
          maturity_date?: string
          name: string
          saved_amount?: number
          start_date?: string
          status?: string
          target_amount?: number
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_rate?: number
          maturity_date?: string
          name?: string
          saved_amount?: number
          start_date?: string
          status?: string
          target_amount?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_savings_deposits: {
        Row: {
          amount: number
          created_at: string
          id: string
          savings_id: string
          stk_reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          savings_id: string
          stk_reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          savings_id?: string
          stk_reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_savings_deposits_savings_id_fkey"
            columns: ["savings_id"]
            isOneToOne: false
            referencedRelation: "personal_savings"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          category?: string
          description?: string | null
          id?: string
          key: string
          label?: string
          updated_at?: string
          value?: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string
          county: string
          created_at: string
          date_of_birth: string
          disable_reason: string | null
          email: string
          full_name: string
          id: string
          id_number: string
          is_active: boolean
          is_admin: boolean | null
          is_verified: boolean
          phone: string
          sub_county: string
          user_id: string
          ward: string
        }
        Insert: {
          address?: string
          county?: string
          created_at?: string
          date_of_birth?: string
          disable_reason?: string | null
          email?: string
          full_name?: string
          id?: string
          id_number?: string
          is_active?: boolean
          is_admin?: boolean | null
          is_verified?: boolean
          phone?: string
          sub_county?: string
          user_id: string
          ward?: string
        }
        Update: {
          address?: string
          county?: string
          created_at?: string
          date_of_birth?: string
          disable_reason?: string | null
          email?: string
          full_name?: string
          id?: string
          id_number?: string
          is_active?: boolean
          is_admin?: boolean | null
          is_verified?: boolean
          phone?: string
          sub_county?: string
          user_id?: string
          ward?: string
        }
        Relationships: []
      }
      savings_withdrawal_requests: {
        Row: {
          admin_reason: string | null
          created_at: string
          id: string
          penalty_percentage: number
          reason: string
          savings_id: string
          status: string
          user_id: string
        }
        Insert: {
          admin_reason?: string | null
          created_at?: string
          id?: string
          penalty_percentage?: number
          reason?: string
          savings_id: string
          status?: string
          user_id: string
        }
        Update: {
          admin_reason?: string | null
          created_at?: string
          id?: string
          penalty_percentage?: number
          reason?: string
          savings_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_withdrawal_requests_savings_id_fkey"
            columns: ["savings_id"]
            isOneToOne: false
            referencedRelation: "personal_savings"
            referencedColumns: ["id"]
          },
        ]
      }
      stk_transactions: {
        Row: {
          amount: number
          checkout_request_id: string | null
          created_at: string
          group_id: string | null
          harambee_id: string | null
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          purpose: string | null
          reference: string
          result_code: string | null
          result_desc: string | null
          savings_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          checkout_request_id?: string | null
          created_at?: string
          group_id?: string | null
          harambee_id?: string | null
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone: string
          purpose?: string | null
          reference?: string
          result_code?: string | null
          result_desc?: string | null
          savings_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_request_id?: string | null
          created_at?: string
          group_id?: string | null
          harambee_id?: string | null
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone?: string
          purpose?: string | null
          reference?: string
          result_code?: string | null
          result_desc?: string | null
          savings_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stk_transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chama_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stk_transactions_savings_id_fkey"
            columns: ["savings_id"]
            isOneToOne: false
            referencedRelation: "personal_savings"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_type?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          admin_notes: string | null
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transfers: {
        Row: {
          amount: number
          cancelled_at: string | null
          created_at: string
          id: string
          reason: string | null
          receiver_id: string
          receiver_name: string | null
          sender_id: string
          sender_name: string | null
          status: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          receiver_id: string
          receiver_name?: string | null
          sender_id: string
          sender_name?: string | null
          status?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          receiver_id?: string
          receiver_name?: string | null
          sender_id?: string
          sender_name?: string | null
          status?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_reason: string | null
          amount: number
          created_at: string
          id: string
          phone: string
          status: string
          user_id: string
        }
        Insert: {
          admin_reason?: string | null
          amount: number
          created_at?: string
          id?: string
          phone: string
          status?: string
          user_id: string
        }
        Update: {
          admin_reason?: string | null
          amount?: number
          created_at?: string
          id?: string
          phone?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_wallet_transfer: {
        Args: { _transfer_id: string; _user_id: string }
        Returns: undefined
      }
      credit_wallet_on_loan_approval: {
        Args: { _amount: number; _loan_id: string; _user_id: string }
        Returns: undefined
      }
      get_active_chama_member_count: {
        Args: { _group_id: string }
        Returns: number
      }
      handle_join_request: {
        Args: { chairperson_id: string; decision: string; request_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chama_leader: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_chama_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      request_withdrawal_secure: {
        Args: { _amount: number; _phone: string; _user_id: string }
        Returns: string
      }
      transfer_wallet_funds: {
        Args: {
          _amount: number
          _reason?: string
          _receiver_id: string
          _receiver_name?: string
          _sender_id: string
          _sender_name?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
