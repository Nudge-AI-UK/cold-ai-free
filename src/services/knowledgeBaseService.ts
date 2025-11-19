import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Constants for limits
export const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
export const SOFT_DELETE_RETENTION_DAYS = 30;

// AI generation limits per entry based on subscription
export const AI_GENERATION_LIMITS = {
  free: 1,
  basic: 2,
  standard: 3,
  pro: 5,
  team: 10,
  team_basic: 5,
  team_xl: 10
};

// Monthly creation limits (how many can be created per month)
export const MONTHLY_CREATION_LIMITS = {
  free: { products: 2, company_info: 2, case_studies: 2 },
  basic: { products: 6, company_info: 6, case_studies: 6 },
  standard: { products: 10, company_info: 10, case_studies: 10 },
  pro: { products: 20, company_info: 20, case_studies: 20 },
  team: { products: 100, company_info: 100, case_studies: 100 },
  team_basic: { products: 40, company_info: 40, case_studies: 40 },
  team_xl: { products: 100, company_info: 100, case_studies: 100 }
};

export class KnowledgeBaseService {
  /**
   * Check if user can create a new entry of the specified type
   */
  static async canCreateEntry(userId: string, entryType: string, planType: string) {
    try {
      // Get this month's creation count
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('knowledge_base_lifecycle')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('entry_type', entryType)
        .eq('action', 'created')
        .gte('created_at', startOfMonth.toISOString());

      if (error) throw error;

      const limits = MONTHLY_CREATION_LIMITS[planType as keyof typeof MONTHLY_CREATION_LIMITS] || MONTHLY_CREATION_LIMITS.free;
      const limitKey = entryType === 'product' ? 'products' : 
                      entryType === 'company' ? 'company_info' : 'case_studies';
      
      // TESTING: Limit check disabled for testing
      return {
        canCreate: true, // (count || 0) < limits[limitKey as keyof typeof limits],
        used: count || 0,
        limit: limits[limitKey as keyof typeof limits]
      };
    } catch (error) {
      console.error('Error checking creation limits:', error);
      return { canCreate: false, used: 0, limit: 0 };
    }
  }

  /**
   * Track entry creation for monthly limits
   */
  static async trackCreation(userId: string, entryType: string, entryId: number, entryData: any) {
    try {
      const { error } = await supabase
        .from('knowledge_base_lifecycle')
        .insert({
          user_id: userId,
          entry_type: entryType,
          action: 'created',
          knowledge_base_id: entryId,
          entry_data: {
            title: entryData.title,
            created_at: new Date().toISOString()
          }
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error tracking creation:', error);
    }
  }

  /**
   * Check if user can use AI generation for an entry
   */
  static async canUseAIGeneration(entryId: number, planType: string) {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('ai_generation_count')
        .eq('id', entryId)
        .single();

      if (error) throw error;

      const limit = AI_GENERATION_LIMITS[planType as keyof typeof AI_GENERATION_LIMITS] || AI_GENERATION_LIMITS.free;
      
      return {
        canGenerate: (data?.ai_generation_count || 0) < limit,
        used: data?.ai_generation_count || 0,
        limit
      };
    } catch (error) {
      console.error('Error checking AI generation limits:', error);
      return { canGenerate: false, used: 0, limit: 0 };
    }
  }

  /**
   * Track AI generation usage
   */
  static async trackAIGeneration(userId: string, entryId: number, generationType: string) {
    try {
      // First, get the current AI generation count
      const { data: currentData, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('ai_generation_count')
        .eq('id', entryId)
        .single();

      if (fetchError) throw fetchError;

      const currentCount = currentData?.ai_generation_count || 0;

      // Update the entry's AI generation count
      const { error: updateError } = await supabase
        .from('knowledge_base')
        .update({
          ai_generation_count: currentCount + 1,
          last_ai_generation: new Date().toISOString()
        })
        .eq('id', entryId);

      if (updateError) throw updateError;

      // Track in AI usage table
      const { error: insertError } = await supabase
        .from('knowledge_base_ai_usage')
        .insert({
          user_id: userId,
          knowledge_base_id: entryId,
          generation_type: generationType,
          tokens_used: 0, // Will be updated when we integrate with actual AI service
          cost_estimate: 0 // Will be calculated based on tokens
        });

      if (insertError) throw insertError;
    } catch (error) {
      console.error('Error tracking AI generation:', error);
    }
  }

  /**
   * Soft delete an entry with grace period
   */
  static async deleteEntry(userId: string, entryId: number, entryType: string) {
    try {
      // Check for dependent ICPs if it's a product
      if (entryType === 'product') {
        const { data: icps, error: icpError } = await supabase
          .from('icps')
          .select('id, icp_name')
          .eq('product_link_id', entryId.toString());

        if (icpError) throw icpError;

        if (icps && icps.length > 0) {
          // Return dependency information
          return {
            success: false,
            hasDependencies: true,
            dependencies: icps,
            message: `Cannot delete: ${icps.length} Customer Profile(s) depend on this product`
          };
        }
      }

      // Get entry data before deletion for tracking
      const { data: entryData, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('title, content')
        .eq('id', entryId)
        .single();

      if (fetchError) throw fetchError;

      // Perform soft delete with grace period
      const canRestoreUntil = new Date(Date.now() + GRACE_PERIOD_MS);
      
      const { error: deleteError } = await supabase
        .from('knowledge_base')
        .update({
          deleted_at: new Date().toISOString(),
          can_restore_until: canRestoreUntil.toISOString()
        })
        .eq('id', entryId);

      if (deleteError) throw deleteError;

      // Track deletion
      await supabase
        .from('knowledge_base_lifecycle')
        .insert({
          user_id: userId,
          entry_type: entryType,
          action: 'deleted',
          knowledge_base_id: entryId,
          entry_data: {
            title: entryData?.title,
            deleted_at: new Date().toISOString(),
            can_restore_until: canRestoreUntil.toISOString()
          }
        });

      return {
        success: true,
        canRestoreUntil,
        entryTitle: entryData?.title
      };
    } catch (error) {
      console.error('Error deleting entry:', error);
      return {
        success: false,
        error: 'Failed to delete entry'
      };
    }
  }

  /**
   * Restore a soft-deleted entry
   */
  static async restoreEntry(userId: string, entryId: number) {
    try {
      // Check if still within grace period
      const { data, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('can_restore_until, knowledge_type, title')
        .eq('id', entryId)
        .single();

      if (fetchError) throw fetchError;

      if (!data?.can_restore_until) {
        return {
          success: false,
          error: 'Entry cannot be restored'
        };
      }

      const canRestoreUntil = new Date(data.can_restore_until);
      if (canRestoreUntil < new Date()) {
        return {
          success: false,
          error: 'Grace period has expired'
        };
      }

      // Restore the entry
      const { error: restoreError } = await supabase
        .from('knowledge_base')
        .update({
          deleted_at: null,
          can_restore_until: null
        })
        .eq('id', entryId);

      if (restoreError) throw restoreError;

      // Track restoration
      await supabase
        .from('knowledge_base_lifecycle')
        .insert({
          user_id: userId,
          entry_type: data.knowledge_type,
          action: 'restored',
          knowledge_base_id: entryId,
          entry_data: {
            title: data.title,
            restored_at: new Date().toISOString()
          }
        });

      return {
        success: true,
        entryTitle: data.title
      };
    } catch (error) {
      console.error('Error restoring entry:', error);
      return {
        success: false,
        error: 'Failed to restore entry'
      };
    }
  }

  /**
   * Get monthly usage statistics
   */
  static async getMonthlyUsageStats(userId: string, planType: string) {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Get creation counts
      const { data: creations, error: creationError } = await supabase
        .from('knowledge_base_lifecycle')
        .select('entry_type')
        .eq('user_id', userId)
        .eq('action', 'created')
        .gte('created_at', startOfMonth.toISOString());

      if (creationError) throw creationError;

      // Count by type
      const creationCounts = {
        product: 0,
        company: 0,
        case_study: 0
      };

      creations?.forEach(item => {
        if (item.entry_type in creationCounts) {
          creationCounts[item.entry_type as keyof typeof creationCounts]++;
        }
      });

      // Get AI usage count
      const { count: aiUsageCount, error: aiError } = await supabase
        .from('knowledge_base_ai_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString());

      if (aiError) throw aiError;

      const limits = MONTHLY_CREATION_LIMITS[planType as keyof typeof MONTHLY_CREATION_LIMITS] || MONTHLY_CREATION_LIMITS.free;

      return {
        creations: creationCounts,
        limits: limits,
        aiUsage: aiUsageCount || 0
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }
}
