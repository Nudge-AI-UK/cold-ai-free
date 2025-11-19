// Account Deletion Service
import { supabase } from '@/integrations/supabase/client'

export const accountDeletionService = {
  /**
   * Request account deletion (30-day soft delete)
   */
  async requestDeletion(reason?: string) {
    try {
      const { data, error } = await supabase.functions.invoke('request-account-deletion', {
        body: { deletion_reason: reason }
      })

      if (error) throw error

      return {
        success: true,
        data: data as {
          soft_delete_until: string
          days_until_permanent: number
        }
      }
    } catch (error: any) {
      console.error('Failed to request account deletion:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete account'
      }
    }
  },

  /**
   * Check if email was previously deleted
   */
  async checkDeletionHistory(email: string) {
    try {
      const { data, error } = await supabase.rpc('check_email_deletion_history', {
        p_email: email
      })

      if (error) throw error

      return {
        success: true,
        data: data?.[0] || null
      }
    } catch (error: any) {
      console.error('Failed to check deletion history:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}
