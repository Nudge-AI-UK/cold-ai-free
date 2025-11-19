import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ICP {
  id: string;
  created_by: string;
  team_id?: string;
  icp_name: string;
  description?: string;
  industry_focus?: string[];
  company_size_range?: string;
  job_titles?: string[];
  pain_points?: string[];
  value_drivers?: string[];
  geographic_focus?: string[];
  technology_stack?: string[];
  budget_range?: string;
  decision_making_process?: string;
  objections_and_concerns?: string[];
  success_metrics?: string[];
  sales_cycle_length?: string;
  preferred_communication_channels?: string[];
  competitive_alternatives?: string[];
  company_characteristics?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  can_restore_until?: string | null;
  product_link_id?: string;
  product_name?: string;
}

export interface DeletionResult {
  success: boolean;
  canRestoreUntil?: Date;
  message?: string;
  error?: string;
}

// Subscription tier limits for ICPs
const SUBSCRIPTION_LIMITS = {
  free: { icps: 1 },
  basic: { icps: 3 },
  standard: { icps: 5 },
  pro: { icps: 10 },
  team: { icps: 50 },
  team_basic: { icps: 20 },
  team_xl: { icps: 50 }
};

class ICPService {
  /**
   * Get all ICPs (excluding soft-deleted)
   */
  async getICPs(userId: string): Promise<ICP[]> {
    const { data, error } = await supabase
      .from('icps')  // Fixed: was 'ideal_customer_profiles'
      .select('*')
      .eq('created_by', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ICPs:', error);
      throw error;
    }

    // Fetch product names for each ICP
    const icpsWithProducts = await Promise.all((data || []).map(async (icp) => {
      if (icp.product_link_id) {
        const { data: productData } = await supabase
          .from('knowledge_base')
          .select('title')
          .eq('id', icp.product_link_id)
          .single();
        
        return {
          ...icp,
          product_name: productData?.title || 'Unknown Product'
        };
      }
      return { ...icp, product_name: 'Unknown Product' };
    }));

    return icpsWithProducts as ICP[];
  }

  /**
   * Get soft-deleted ICPs that can still be restored
   */
  async getDeletedICPs(userId: string): Promise<ICP[]> {
    const { data, error } = await supabase
      .from('icps')  // Fixed: was 'ideal_customer_profiles'
      .select('*')
      .eq('created_by', userId)
      .not('deleted_at', 'is', null)
      .gte('can_restore_until', new Date().toISOString())
      .order('deleted_at', { ascending: false });

    if (error) {
      console.error('Error fetching deleted ICPs:', error);
      throw error;
    }

    // Fetch product names for deleted ICPs too
    const icpsWithProducts = await Promise.all((data || []).map(async (icp) => {
      if (icp.product_link_id) {
        const { data: productData } = await supabase
          .from('knowledge_base')
          .select('title')
          .eq('id', icp.product_link_id)
          .single();
        
        return {
          ...icp,
          product_name: productData?.title || 'Unknown Product'
        };
      }
      return { ...icp, product_name: 'Unknown Product' };
    }));

    return icpsWithProducts as ICP[];
  }

  /**
   * Soft delete an ICP
   */
  async deleteICP(id: string): Promise<DeletionResult> {
    try {
      const now = new Date();
      const canRestoreUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { error } = await supabase
        .from('icps')  // Fixed: was 'ideal_customer_profiles'
        .update({
          deleted_at: now.toISOString(),
          can_restore_until: canRestoreUntil.toISOString(),
          is_active: false,
          updated_at: now.toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Error soft deleting ICP:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        canRestoreUntil,
        message: 'ICP moved to trash. You can restore it within 30 days.'
      };
    } catch (error) {
      console.error('Error in deleteICP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete ICP'
      };
    }
  }

  /**
   * Restore a soft-deleted ICP
   */
  async restoreICP(id: string, userId: string): Promise<DeletionResult> {
    try {
      // Check user's subscription and active ICP count
      const canRestore = await this.checkRestoreEligibility(userId);
      
      if (!canRestore.canRestore) {
        return {
          success: false,
          error: canRestore.reason
        };
      }

      const { error } = await supabase
        .from('icps')  // Fixed: was 'ideal_customer_profiles'
        .update({
          deleted_at: null,
          can_restore_until: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Error restoring ICP:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        message: 'ICP restored successfully'
      };
    } catch (error) {
      console.error('Error in restoreICP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore ICP'
      };
    }
  }

  /**
   * Permanently delete an ICP
   */
  async permanentlyDeleteICP(id: string): Promise<DeletionResult> {
    try {
      const { error } = await supabase
        .from('icps')  // Fixed: was 'ideal_customer_profiles'
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error permanently deleting ICP:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        message: 'ICP permanently deleted'
      };
    } catch (error) {
      console.error('Error in permanentlyDeleteICP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to permanently delete ICP'
      };
    }
  }

  /**
   * Check if user can restore an ICP based on subscription limits
   */
  private async checkRestoreEligibility(userId: string): Promise<{ canRestore: boolean; reason?: string }> {
    try {
      // Get user's subscription
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('plan_type')
        .eq('user_id', userId)
        .single();

      const planType = subscription?.plan_type || 'free';
      const limit = SUBSCRIPTION_LIMITS[planType as keyof typeof SUBSCRIPTION_LIMITS]?.icps || 1;

      // Count active ICPs
      const { count } = await supabase
        .from('icps')  // Fixed: was 'ideal_customer_profiles'
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)
        .is('deleted_at', null);

      const activeCount = count || 0;

      // TESTING: Limit check disabled for testing
      // if (activeCount >= limit) {
      //   return {
      //     canRestore: false,
      //     reason: `You've reached your ICP limit (${limit}) for your ${planType} plan. Please upgrade or delete another ICP first.`
      //   };
      // }

      return { canRestore: true };
    } catch (error) {
      console.error('Error checking restore eligibility:', error);
      return {
        canRestore: false,
        reason: 'Failed to check subscription limits'
      };
    }
  }

  /**
   * Create a new ICP
   */
  async createICP(data: Partial<ICP>): Promise<ICP> {
    const { data: newICP, error } = await supabase
      .from('icps')  // Fixed: was 'ideal_customer_profiles'
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Error creating ICP:', error);
      throw error;
    }

    return newICP as ICP;
  }

  /**
   * Update an ICP
   */
  async updateICP(id: string, updates: Partial<ICP>): Promise<ICP> {
    const { data: updatedICP, error } = await supabase
      .from('icps')  // Fixed: was 'ideal_customer_profiles'
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating ICP:', error);
      throw error;
    }

    return updatedICP as ICP;
  }
}

export const icpService = new ICPService();
