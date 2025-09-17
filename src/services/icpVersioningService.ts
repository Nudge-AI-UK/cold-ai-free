import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ICPApprovalResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export class ICPVersioningService {
  /**
   * Approve ICP with changes and trigger n8n review workflow
   * This creates a webhook event that triggers the database function
   */
  static async approveWithChanges(
    icpId: string,
    updatedData: any,
    userId: string,
    reviewNotes?: string
  ): Promise<ICPApprovalResult> {
    try {
      console.log('📝 [ICPVersioning] Starting approval process', {
        icpId,
        userId,
        hasUpdates: !!updatedData,
        reviewNotes
      });

      // Step 1: Fetch the current/original ICP data
      const { data: originalICP, error: fetchError } = await supabase
        .from('icps')
        .select('*')
        .eq('id', icpId)
        .single();

      if (fetchError) {
        console.error('❌ [ICPVersioning] Error fetching original ICP:', fetchError);
        return {
          success: false,
          error: fetchError.message,
          message: 'Failed to fetch ICP data'
        };
      }

      console.log('✅ [ICPVersioning] Original ICP fetched:', {
        id: originalICP.id,
        name: originalICP.icp_name,
        currentStatus: originalICP.workflow_status
      });

      // Step 2: Create webhook event with both original and updated data
      // This will trigger the database trigger for n8n
      // Using 'icp_approved_for_review' to match the database trigger and edge function
      const webhookPayload = {
        event_type: 'icp_approved_for_review', // Changed to match trigger and edge function
        source: 'icp',
        status: 'pending',
        user_id: userId,
        processed: false, // Explicitly set to false to match trigger condition
        payload: {
          icp_id: icpId,
          original_data: originalICP,
          updated_data: updatedData,
          review_notes: reviewNotes || '',
          changes_made: Object.keys(updatedData).filter(key => 
            JSON.stringify(originalICP[key]) !== JSON.stringify(updatedData[key])
          ),
          approved_by: userId,
          approved_at: new Date().toISOString()
        }
      };

      console.log('📤 [ICPVersioning] Creating webhook event:', {
        event_type: webhookPayload.event_type,
        changes_count: webhookPayload.payload.changes_made.length,
        processed: webhookPayload.processed
      });

      const { data: webhookEvent, error: webhookError } = await supabase
        .from('webhook_events')
        .insert(webhookPayload)
        .select()
        .single();

      if (webhookError) {
        console.error('❌ [ICPVersioning] Error creating webhook event:', webhookError);
        return {
          success: false,
          error: webhookError.message,
          message: 'Failed to create review request'
        };
      }

      console.log('✅ [ICPVersioning] Webhook event created:', {
        id: webhookEvent.id,
        status: webhookEvent.status,
        event_type: webhookEvent.event_type
      });

      // Step 3: Update the ICP with approved changes and status
      // Only include columns that exist in the database
      const icpUpdate = {
        ...updatedData,
        workflow_status: 'reviewing',
        review_status: 'approved',
        updated_at: new Date().toISOString()
      };

      console.log('📝 [ICPVersioning] Updating ICP with approved changes:', {
        workflow_status: icpUpdate.workflow_status,
        review_status: icpUpdate.review_status
      });

      const { data: updatedICP, error: updateError } = await supabase
        .from('icps')
        .update(icpUpdate)
        .eq('id', icpId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ [ICPVersioning] Error updating ICP:', updateError);
        
        // Try to clean up webhook event
        await supabase
          .from('webhook_events')
          .update({ 
            status: 'failed', 
            error_message: updateError.message,
            processed: true 
          })
          .eq('id', webhookEvent.id);

        return {
          success: false,
          error: updateError.message,
          message: 'Failed to update ICP'
        };
      }

      console.log('✅ [ICPVersioning] ICP approved and updated successfully:', {
        id: updatedICP.id,
        name: updatedICP.icp_name,
        newStatus: updatedICP.workflow_status,
        reviewStatus: updatedICP.review_status
      });

      // The database trigger should now fire and call the edge function
      // The edge function will then process it and send to n8n if configured
      toast.success('ICP approved and sent for AI review');

      return {
        success: true,
        data: updatedICP,
        message: 'ICP approved and review workflow triggered'
      };

    } catch (error) {
      console.error('❌ [ICPVersioning] Unexpected error in approval:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to approve ICP'
      };
    }
  }

  /**
   * Get the review status for an ICP
   */
  static async getReviewStatus(icpId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('icps')
        .select('workflow_status, review_status, metadata')
        .eq('id', icpId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching review status:', error);
      return null;
    }
  }

  /**
   * Check if ICP has pending changes
   */
  static async hasPendingChanges(icpId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('id, status')
        .eq('payload->icp_id', icpId)
        .eq('event_type', 'icp_approved_for_review')  // Updated to match
        .eq('status', 'pending')
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('Error checking pending changes:', error);
      return false;
    }
  }
}
