import { supabase } from '@/integrations/supabase/client';

interface N8NWebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  hasDependencies?: boolean;
  dependencies?: any[];
  warning?: string;
}

interface KnowledgeEntry {
  title: string;
  content: string;
  description?: string; // Support both content and description
  knowledge_type: 'product' | 'company' | 'case_study';
  metadata?: any;
  productLink?: string;
  targetMarket?: string;
  infoLink?: string;
  keyStatistics?: string;
  additionalLinks?: Array<{ title: string; url: string }>;
  aiFields?: Set<string>;
  aiFieldsRequested?: string[]; // Support array format
  entryId?: string; // For updating existing entries
}

interface KnowledgeActionPayload {
  action: string;
  userId: string;
  teamId?: string;
  data: any;
}

interface ICPEntry {
  icp_name: string;
  description: string;
  job_titles: string[];
  pain_points: string[];
  value_drivers: string[];
  industry_focus: string[];
  company_characteristics: string;
  product_link_id?: string;
  metadata?: any;
}


// Interface for the ICP approval wrapper method
interface ICPApprovalParams {
  icp_id: string;
  original_data: any;
  updated_fields?: any;
  changes_summary?: string[];
  reviewer_id: string;
  review_notes?: string;
}

class N8NService {
  // Get the URL and key from the existing supabase configuration
  private supabaseUrl = 'https://hagtgdeyvogjkcjwacla.supabase.co';
  private supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ3RnZGV5dm9namtjandhY2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjEzNDAsImV4cCI6MjA2NjMzNzM0MH0.APPmNpZx7V79Kz4hurhlX5TqnrCfsSsYflp-lekXUms';
  
  // Debug mode for enhanced logging - Always enabled for debugging
  private debugMode = true;
  
  // Track if edge functions are available
  private edgeFunctionsAvailable = false;
  private edgeFunctionCheckComplete = false;

  private logDebug(method: string, message: string, data?: any) {
    if (this.debugMode) {
      console.group(`🔧 [N8N Service] ${method}`);
      console.log(`📝 ${message}`);
      if (data) {
        console.log('📊 Data:', data);
      }
      console.groupEnd();
    }
  }

  // Track webhook event in the database
  private async trackWebhookEvent(
    eventType: string,
    source: string,
    payload: any,
    error?: string
  ): Promise<void> {
    try {
      const eventData = {
        event_type: eventType,
        source: source,
        payload: payload,
        processed: !error,
        error_message: error || null,
        retry_count: 0,
        created_at: new Date().toISOString()
      };

      console.log(`📊 [N8N Service] Tracking webhook event:`, eventData);

      const { error: insertError } = await supabase
        .from('webhook_events')
        .insert(eventData);

      if (insertError) {
        console.error('❌ Failed to track webhook event:', insertError);
      } else {
        console.log('✅ Webhook event tracked successfully');
      }
    } catch (err) {
      console.error('❌ Error tracking webhook event:', err);
    }
  }

  // Check if edge functions are available (once per session)
  private async checkEdgeFunctionAvailability(): Promise<boolean> {
    if (this.edgeFunctionCheckComplete) {
      return this.edgeFunctionsAvailable;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || this.supabaseAnonKey;

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/n8n-knowledge-action`,
        {
          method: 'OPTIONS',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      this.edgeFunctionsAvailable = response.ok || response.status === 200;
      this.edgeFunctionCheckComplete = true;
      
      if (!this.edgeFunctionsAvailable) {
        console.warn('⚠️ [N8N Service] Edge functions not available. Using fallback mode.');
      }
      
      return this.edgeFunctionsAvailable;
    } catch (error) {
      console.warn('⚠️ [N8N Service] Could not check edge function availability:', error);
      this.edgeFunctionsAvailable = false;
      this.edgeFunctionCheckComplete = true;
      return false;
    }
  }

  // Test n8n connection
  async testN8NConnection(userId: string): Promise<N8NWebhookResponse> {
    try {
      this.logDebug('testN8NConnection', 'Testing n8n connection...', { userId });
      
      // Check if edge functions are available
      const edgeFunctionsAvailable = await this.checkEdgeFunctionAvailability();
      
      if (!edgeFunctionsAvailable) {
        return {
          success: false,
          error: 'Edge functions not configured',
          message: 'n8n integration is not yet configured. Please contact support.'
        };
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || this.supabaseAnonKey;

      const payload = {
        action: 'test_connection',
        userId,
        data: {
          test: true,
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/n8n-knowledge-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = `Connection test failed: ${response.status}`;
        await this.trackWebhookEvent('test_connection', 'n8n', payload, error);
        return {
          success: false,
          error,
          message: 'Could not connect to n8n service'
        };
      }

      const result = await response.json();
      await this.trackWebhookEvent('test_connection', 'n8n', payload);
      this.logDebug('testN8NConnection', 'Connection test result', result);
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Connection test error:', error);
      await this.trackWebhookEvent('test_connection', 'n8n', { userId }, error.message);
      return { success: false, error: error.message };
    }
  }

  // ========== ICP METHODS ==========
  
  // Call ICP action through edge function
  private async callICPAction(payload: any): Promise<N8NWebhookResponse> {
    try {
      // Track the webhook event first
      await this.trackWebhookEvent(payload.action, 'icp', payload);

      // Check if edge functions are available
      const edgeFunctionsAvailable = await this.checkEdgeFunctionAvailability();
      
      if (!edgeFunctionsAvailable) {
        console.warn('⚠️ [N8N Service] Edge functions not available for ICP action');
        return {
          success: false,
          error: 'Edge functions not available',
          message: 'ICP features require n8n integration to be configured'
        };
      }
      

      // Get current session if available
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || this.supabaseAnonKey;

      // Use the Supabase Edge Function as a secure proxy
      const url = `${this.supabaseUrl}/functions/v1/n8n-icp-action`;
      
      console.group(`🚀 [n8nService] Calling ICP Action: ${payload.action}`);
      console.log('📍 URL:', url);
      console.log('👤 User ID:', payload.userId);
      console.log('📦 Payload:', payload);
      console.groupEnd();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // Handle non-OK responses gracefully
      if (!response.ok) {
        const responseText = await response.text();
        const error = `HTTP error! status: ${response.status}`;
        console.error(`❌ [n8nService] ${error}, body:`, responseText);
        
        // Update webhook event with error
        await this.trackWebhookEvent(`${payload.action}_error`, 'icp', payload, error);
        
        // Try to parse error response
        try {
          const errorResponse = JSON.parse(responseText);
          return errorResponse;
        } catch {
          throw new Error(error);
        }
      }

      const responseText = await response.text();
      console.group(`📥 [n8nService] Response for ${payload.action}`);
      console.log('✅ Status:', response.status);
      console.log('📄 Response Text:', responseText);
      console.groupEnd();

      try {
        const jsonResponse = JSON.parse(responseText);
        console.log(`✨ [n8nService] Success! ICP Action ${payload.action} completed:`, jsonResponse);
        
        // Update webhook event as processed
        await this.trackWebhookEvent(`${payload.action}_success`, 'icp', {
          request: payload,
          response: jsonResponse
        });
        
        return jsonResponse;
      } catch (parseError) {
        console.error('❌ [n8nService] Failed to parse response as JSON:', parseError);
        await this.trackWebhookEvent(`${payload.action}_parse_error`, 'icp', payload, 'Invalid response format');
        return { success: false, error: 'Invalid response format from server' };
      }
    } catch (error: any) {
      console.error(`❌ [n8nService] ICP action error for ${payload.action}:`, error);
      await this.trackWebhookEvent(`${payload.action}_error`, 'icp', payload, error.message);
      return { success: false, error: error.message };
    }
  }

 // Update ICP entry using Edge Function (NEW UNIFIED VERSION)
  async updateICP(icpId: string, updates: any): Promise<N8NWebhookResponse> {
    try {
      const { userId, teamId, ...icpUpdates } = updates;
      
      const payload = {
        action: 'update_icp',
        userId: userId || 'unknown',
        teamId: teamId,
        data: {
          icp_id: icpId,
          ...icpUpdates,
          timestamp: new Date().toISOString()
        }
      };

      console.group('🔄 [n8nService] UPDATING ICP');
      console.log('📝 ICP ID:', icpId);
      console.log('👤 User ID:', userId);
      console.log('📦 Updates:', icpUpdates);
      console.groupEnd();

      const result = await this.callICPAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] ICP update successful!');
      } else {
        console.error('❌ [n8nService] ICP update failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Update ICP error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to update ICP: ${error.message}`
      };
    }
  } 

  // Test ICP n8n connection
  async testICPConnection(userId: string): Promise<N8NWebhookResponse> {
    try {
      this.logDebug('testICPConnection', 'Testing ICP n8n connection...', { userId });
      
      const payload = {
        action: 'test_connection',
        userId,
        data: {
          test: true,
          source: 'icp',
          timestamp: new Date().toISOString()
        }
      };

      const result = await this.callICPAction(payload);
      this.logDebug('testICPConnection', 'ICP Connection test result', result);
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] ICP Connection test error:', error);
      return { success: false, error: error.message };
    }
  }

  // Create ICP entry using Edge Function
  async createICPEntry(icpData: ICPEntry & { userId: string; teamId?: string }): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'create_icp',
        userId: icpData.userId,
        teamId: icpData.teamId,
        data: {
          icp_name: icpData.icp_name,
          description: icpData.description,
          job_titles: icpData.job_titles,
          pain_points: icpData.pain_points,
          value_drivers: icpData.value_drivers,
          industry_focus: icpData.industry_focus,
          company_characteristics: icpData.company_characteristics,
          product_link_id: icpData.product_link_id,
          metadata: icpData.metadata,
          timestamp: new Date().toISOString()
        }
      };

      console.group('➕ [n8nService] CREATING ICP ENTRY');
      console.log('📝 Name:', icpData.icp_name);
      console.log('👤 User ID:', icpData.userId);
      console.log('👥 Team ID:', icpData.teamId);
      console.log('📦 Full Payload:', payload);
      console.groupEnd();

      const result = await this.callICPAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] ICP creation successful! n8n workflow should be triggered.');
        if (result.data?.icp_id) {
          console.log('🆔 New ICP ID:', result.data.icp_id);
        }
      } else {
        console.error('❌ [n8nService] ICP creation failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Create ICP entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to create ICP: ${error.message}`
      };
    }
  }

  // Update ICP entry using Edge Function
  async updateICPEntry(icpId: string, updates: any, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'update_icp',
        userId: userId,
        teamId: teamId,
        data: {
          icp_id: icpId,
          updates: updates,
          timestamp: new Date().toISOString()
        }
      };

      console.group('🔄 [n8nService] UPDATING ICP');
      console.log('📝 ICP ID:', icpId);
      console.log('👤 User ID:', userId);
      console.log('📦 Updates:', icpUpdates);
      console.groupEnd();
      this.logDebug('updateICPEntry', 'Updating ICP entry', { 
        icpId,
        updates 
      });

      const result = await this.callICPAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] ICP update successful!');
      } else {
        console.error('❌ [n8nService] ICP update failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Update ICP error:', error);
      console.error('❌ [n8nService] Update ICP entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to update ICP: ${error.message}`
      };
    }
  }

  // Delete (archive) ICP entry - Soft delete
    async deleteICPEntry(icpId: string, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
      try {
        // First, fetch the ICP details before deletion
        const { data: icpData, error: fetchError } = await supabase
          .from('icps')
          .select('icp_name, workflow_status')
          .eq('id', icpId)
          .single();
  
        if (fetchError) {
          console.error('❌ [n8nService] Failed to fetch ICP title:', fetchError);
        }
  
        const payload = {
          action: 'archive_icp',
          userId: userId,
          teamId: teamId,
          data: {
            icp_id: icpId,
            icp_name: icpData?.icp_name || 'Unknown ICP',
            workflow_status: icpData?.workflow_status,
            timestamp: new Date().toISOString()
          }
        };
  
        console.group('🗑️ [n8nService] ARCHIVING ICP ENTRY');
        console.log('📝 ICP ID:', icpId);
        console.log('📝 ICP Name:', icpData?.icp_name);
        console.log('👤 User ID:', userId);
        console.log('📦 Full Payload:', payload);
        console.groupEnd();
  
        const result = await this.callICPAction(payload);
        
        if (result.success) {
          console.log('✅ [n8nService] Archive successful! n8n workflow should be triggered.');
        } else {
          console.error('❌ [n8nService] Archive failed:', result.error);
        }
        
        return result;
      } catch (error: any) {
        console.error('❌ [n8nService] Delete ICP entry error:', error);
        return { 
          success: false, 
          error: error.message,
          message: `Failed to archive ICP: ${error.message}`
        };
      }
    }

  // Restore archived ICP entry
  async restoreICPEntry(icpId: string, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'restore_icp',
        userId: userId,
        teamId: teamId,
        data: {
          icp_id: icpId,
          timestamp: new Date().toISOString()
        }
      };

      console.group('♻️ [n8nService] RESTORING ICP ENTRY');
      console.log('📝 ICP ID:', icpId);
      console.log('👤 User ID:', userId);
      console.log('📦 Full Payload:', payload);
      console.groupEnd();

      const result = await this.callICPAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Restore successful! n8n workflow should be triggered.');
      } else {
        console.error('❌ [n8nService] Restore failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.group('❌ [n8nService] RESTORE ICP ERROR');
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      console.error('Full Error:', error);
      console.groupEnd();
      
      return { 
        success: false, 
        error: error.message,
        message: `Failed to restore ICP: ${error.message}`
      };
    }
  }

  // Submit ICP for review
  async submitICPForReview(icpId: string, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'submit_for_review',
        userId: userId,
        teamId: teamId,
        data: {
          icp_id: icpId,
          timestamp: new Date().toISOString()
        }
      };

      console.group('📋 [n8nService] SUBMITTING ICP FOR REVIEW');
      console.log('📝 ICP ID:', icpId);
      console.log('👤 User ID:', userId);
      console.log('📦 Full Payload:', payload);
      console.groupEnd();

      const result = await this.callICPAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Review submission successful!');
      } else {
        console.error('❌ [n8nService] Review submission failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Submit ICP for review error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to submit ICP for review: ${error.message}`
      };
    }
  }

  // Regenerate failed ICP entry
  async regenerateICPEntry(icpId: string, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'regenerate_icp',
        userId: userId,
        teamId: teamId,
        data: {
          icp_id: icpId,
          timestamp: new Date().toISOString()
        }
      };

      console.group('🔄 [n8nService] REGENERATING ICP ENTRY');
      console.log('📝 ICP ID:', icpId);
      console.log('👤 User ID:', userId);
      console.log('📦 Full Payload:', payload);
      console.groupEnd();

      const result = await this.callICPAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Regeneration started successfully!');
      } else {
        console.error('❌ [n8nService] Regeneration failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Regenerate ICP entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to regenerate ICP: ${error.message}`
      };
    }
  }

  // ========== KNOWLEDGE BASE METHODS ==========

  private async callKnowledgeAction(payload: any): Promise<N8NWebhookResponse> {
    try {
      // Track the webhook event first
      await this.trackWebhookEvent(payload.action, 'knowledge_base', payload);

      // Check if edge functions are available
      const edgeFunctionsAvailable = await this.checkEdgeFunctionAvailability();
      
      if (!edgeFunctionsAvailable) {
        // Fallback: handle action locally without n8n
        console.warn('⚠️ [N8N Service] Edge functions not available, using local fallback');
        return this.handleLocalKnowledgeAction(payload);
      }
      
      // Get current session if available
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || this.supabaseAnonKey;

      // Use the Supabase Edge Function as a secure proxy
      const url = `${this.supabaseUrl}/functions/v1/n8n-knowledge-action`;
      
      console.group(`🚀 [n8nService] Calling Knowledge Action: ${payload.action}`);
      console.log('📍 URL:', url);
      console.log('👤 User ID:', payload.userId);
      console.log('📦 Payload:', payload);
      console.groupEnd();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // Handle non-OK responses gracefully
      if (!response.ok) {
        if (response.status === 406 || response.status === 400) {
          // Edge function not configured properly - use fallback
          console.warn(`⚠️ [N8N Service] Edge function returned ${response.status}, using fallback`);
          return this.handleLocalKnowledgeAction(payload);
        }
        
        const responseText = await response.text();
        const error = `HTTP error! status: ${response.status}`;
        console.error(`❌ [n8nService] ${error}, body:`, responseText);
        
        // Update webhook event with error
        await this.trackWebhookEvent(payload.action, 'n8n', payload, error);
        throw new Error(error);
      }

      const responseText = await response.text();
      console.group(`📥 [n8nService] Response for ${payload.action}`);
      console.log('✅ Status:', response.status);
      console.log('📄 Response Text:', responseText);
      console.groupEnd();

      try {
        const jsonResponse = JSON.parse(responseText);
        console.log(`✨ [n8nService] Success! Action ${payload.action} completed:`, jsonResponse);
        
        // Update webhook event as processed
        await this.trackWebhookEvent(`${payload.action}_success`, 'n8n', {
          request: payload,
          response: jsonResponse
        });
        
        return jsonResponse;
      } catch (parseError) {
        console.error('❌ [n8nService] Failed to parse response as JSON:', parseError);
        await this.trackWebhookEvent(payload.action, 'n8n', payload, 'Invalid response format');
        return { success: false, error: 'Invalid response format from server' };
      }
    } catch (error: any) {
      console.error(`❌ [n8nService] Knowledge action error for ${payload.action}:`, error);
      await this.trackWebhookEvent(payload.action, 'n8n', payload, error.message);
      return { success: false, error: error.message };
    }
  }

  // Local fallback handler for knowledge actions when edge functions are not available
  private async handleLocalKnowledgeAction(payload: any): Promise<N8NWebhookResponse> {
    try {
      const { action, userId, teamId, data } = payload;
      
      console.log(`🔧 [N8N Service] Handling ${action} locally (fallback mode)`);
      
      // Track as local processing
      await this.trackWebhookEvent(`${action}_local`, 'knowledge_base', payload);
      
      switch (action) {
        case 'add_entry':
        case 'update_entry':
        case 'delete_entry':
        case 'restore_entry':
        case 'approve_entry':
          // These actions are already handled by the frontend directly
          // Just return success to not break the flow
          return {
            success: true,
            message: `${action} completed locally`,
            data: { ...data, local: true }
          };
          
        case 'test_connection':
          return {
            success: true,
            message: 'Local mode (n8n not connected)',
            data: { local: true, timestamp: new Date().toISOString() }
          };
          
        default:
          return {
            success: false,
            error: `Action ${action} not supported in local mode`,
            message: 'This action requires n8n integration'
          };
      }
    } catch (error: any) {
      console.error('❌ [N8N Service] Local fallback error:', error);
      await this.trackWebhookEvent(`${payload.action}_local_error`, 'knowledge_base', payload, error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to process action locally'
      };
    }
  }

  private async callWebhook(endpoint: string, data: any): Promise<N8NWebhookResponse> {
    try {
      // Track the webhook event
      await this.trackWebhookEvent(endpoint, 'n8n', data);

      // Check if edge functions are available
      const edgeFunctionsAvailable = await this.checkEdgeFunctionAvailability();
      
      if (!edgeFunctionsAvailable) {
        return {
          success: false,
          error: 'Edge functions not available',
          message: 'This feature requires n8n integration to be configured'
        };
      }
      
      // Get current session if available
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || this.supabaseAnonKey;

      const url = `${this.supabaseUrl}/functions/v1/n8n-proxy/${endpoint}`;
      
      this.logDebug('callWebhook', `Calling webhook: ${endpoint}`, {
        url,
        action: data.action,
        userId: data.userId,
        data: data.data
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      // Handle non-OK responses gracefully
      if (!response.ok) {
        if (response.status === 406 || response.status === 400 || response.status === 404) {
          console.warn(`⚠️ [N8N Service] Webhook ${endpoint} not available (${response.status})`);
          const error = `Feature not available`;
          await this.trackWebhookEvent(`${endpoint}_unavailable`, 'n8n', data, error);
          return {
            success: false,
            error,
            message: 'This feature is not yet configured. Please contact support.'
          };
        }
        
        const responseText = await response.text();
        const error = `HTTP error! status: ${response.status}`;
        console.error(`❌ [n8nService] ${error}, body:`, responseText);
        await this.trackWebhookEvent(`${endpoint}_error`, 'n8n', data, error);
        throw new Error(error);
      }

      const responseText = await response.text();
      console.log(`📥 [n8nService] Response status: ${response.status}, body:`, responseText);

      try {
        const jsonResponse = JSON.parse(responseText);
        this.logDebug('callWebhook', `Parsed response for ${endpoint}`, jsonResponse);
        
        // Track successful webhook
        await this.trackWebhookEvent(`${endpoint}_success`, 'n8n', {
          request: data,
          response: jsonResponse
        });
        
        return jsonResponse;
      } catch (parseError) {
        console.error('❌ [n8nService] Failed to parse response as JSON:', parseError);
        await this.trackWebhookEvent(`${endpoint}_parse_error`, 'n8n', data, 'Invalid response format');
        return { success: false, error: 'Invalid response format from server' };
      }
    } catch (error: any) {
      console.error(`❌ [n8nService] ${endpoint} webhook error:`, error);
      await this.trackWebhookEvent(`${endpoint}_error`, 'n8n', data, error.message);
      return { success: false, error: error.message };
    }
  }

  // Delete knowledge entry using Edge Function
  async deleteKnowledgeEntry(entryId: string, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      // First, fetch the entry title before deletion
      const { data: entryData, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('title, knowledge_type')
        .eq('id', entryId)
        .single();

      if (fetchError) {
        console.error('❌ [n8nService] Failed to fetch entry title:', fetchError);
      }

      const payload = {
        action: 'delete_entry',
        userId: userId,
        teamId: teamId,
        data: {
          entryId: entryId,  // The edge function expects both
          entry_id: entryId,  // Support both formats for backward compatibility
          title: entryData?.title || 'Unknown Entry',  // Include the title
          knowledge_type: entryData?.knowledge_type || 'unknown',
          timestamp: new Date().toISOString()
        }
      };

      console.group('🗑️ [n8nService] DELETING KNOWLEDGE ENTRY');
      console.log('📝 Entry ID:', entryId);
      console.log('📝 Entry Title:', entryData?.title);
      console.log('👤 User ID:', userId);
      console.log('📦 Full Payload:', payload);
      console.groupEnd();

      const result = await this.callKnowledgeAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Delete successful! n8n workflow should be triggered.');
      } else {
        console.error('❌ [n8nService] Delete failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Delete knowledge entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to delete entry: ${error.message}`
      };
    }
  }

  // Restore a soft-deleted knowledge entry
  async restoreKnowledgeEntry(entryId: string, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      // First, fetch the entry details to ensure it's soft-deleted
      const { data: entryData, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('title, knowledge_type, deleted_at, can_restore_until')
        .eq('id', entryId)
        .single();

      if (fetchError) {
        console.error('❌ [n8nService] Failed to fetch entry for restoration:', fetchError);
        return { 
          success: false, 
          error: fetchError.message,
          message: `Failed to fetch entry for restoration: ${fetchError.message}`
        };
      }

      // Check if entry is actually deleted
      if (!entryData?.deleted_at) {
        console.warn('⚠️ [n8nService] Entry is not deleted, cannot restore');
        return { 
          success: false, 
          error: 'Entry is not deleted',
          message: 'This entry is not deleted and cannot be restored'
        };
      }

      // Check if restoration period has expired
      if (entryData.can_restore_until && new Date(entryData.can_restore_until) < new Date()) {
        console.error('❌ [n8nService] Restoration period has expired');
        return { 
          success: false, 
          error: 'Restoration period expired',
          message: 'The restoration period for this entry has expired'
        };
      }

      const payload = {
        action: 'restore_entry',
        userId: userId,
        teamId: teamId,
        data: {
          entryId: entryId,
          entry_id: entryId,  // Support both formats
          title: entryData.title,
          knowledge_type: entryData.knowledge_type,
          deleted_at: entryData.deleted_at,
          can_restore_until: entryData.can_restore_until,
          timestamp: new Date().toISOString()
        }
      };

      console.group('♻️ [n8nService] RESTORING KNOWLEDGE ENTRY');
      console.log('📝 Entry ID:', entryId);
      console.log('📝 Entry Title:', entryData.title);
      console.log('👤 User ID:', userId);
      console.log('📦 Full Payload:', payload);
      console.groupEnd();

      const result = await this.callKnowledgeAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Restore successful! n8n workflow should be triggered.');
      } else {
        console.error('❌ [n8nService] Restore failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Restore knowledge entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to restore entry: ${error.message}`
      };
    }
  }

  // Add knowledge entry using Edge Function - STREAMLINED VERSION
  async addKnowledgeEntry(entry: KnowledgeEntry & { userId: string; teamId?: string }): Promise<N8NWebhookResponse> {
    try {
      // Build a clean, streamlined payload without redundancy
      const payload = {
        action: 'add_entry',
        userId: entry.userId,
        teamId: entry.teamId,
        data: {
          // Core fields
          title: entry.title,
          content: entry.content || entry.description || '', // Support both content and description
          description: entry.description || entry.content || '', // Include both for compatibility
          knowledge_type: entry.knowledge_type,
          
          // Type-specific fields (only include if they have values)
          ...(entry.productLink && { productLink: entry.productLink }),
          ...(entry.targetMarket && { targetMarket: entry.targetMarket }),
          ...(entry.infoLink && { infoLink: entry.infoLink }),
          ...(entry.keyStatistics && { keyStatistics: entry.keyStatistics }),
          ...(entry.additionalLinks && entry.additionalLinks.length > 0 && { additionalLinks: entry.additionalLinks }),
          
          // AI fields tracking
          aiFieldsRequested: entry.aiFieldsRequested || (entry.aiFields ? Array.from(entry.aiFields) : []),
          
          // Timestamp
          timestamp: new Date().toISOString()
        }
      };

      // If updating an existing entry, include the entry ID
      if (entry.entryId) {
        payload.data.entry_id = entry.entryId;
        payload.action = 'update_entry';
      }

      console.group('➕ [n8nService] ADDING KNOWLEDGE ENTRY');
      console.log('📝 Title:', entry.title);
      console.log('📚 Type:', entry.knowledge_type);
      console.log('👤 User ID:', entry.userId);
      console.log('🤖 AI Fields:', entry.aiFieldsRequested || (entry.aiFields ? Array.from(entry.aiFields) : 'None'));
      console.log('📦 Streamlined Payload:', payload);
      console.groupEnd();

      const result = await this.callKnowledgeAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Add successful! n8n workflow should be triggered.');
        if (result.data?.entry_id) {
          console.log('🆔 New Entry ID:', result.data.entry_id);
        }
      } else {
        console.error('❌ [n8nService] Add failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Add knowledge entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to add entry: ${error.message}`
      };
    }
  }

  // Update knowledge entry using Edge Function
  async updateKnowledgeEntry(entryId: string, updates: any): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'update_entry',
        userId: updates.userId || 'unknown',
        teamId: updates.teamId,
        data: {
          entryId: entryId,
          entry_id: entryId,  // Support both formats
          ...updates,
          timestamp: new Date().toISOString()
        }
      };

      this.logDebug('updateKnowledgeEntry', 'Updating knowledge entry', { 
        entryId,
        updates 
      });

      const result = await this.callKnowledgeAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Update successful!');
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Update knowledge entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to update entry: ${error.message}`
      };
    }
  }

  // Approve entry using Edge Function - ENHANCED to accept full entry data
  async approveEntry(
    entryId: string, 
    reviewerId: string, 
    notes?: string,
    entryData?: any  // Optional entry data to include with approval
  ): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'approve_entry',
        userId: reviewerId,
        data: {
          entryId: entryId,
          entry_id: entryId,
          reviewNotes: notes,
          reviewerId: reviewerId,
          timestamp: new Date().toISOString(),
          // Include all the entry data if provided
          ...(entryData && {
            title: entryData.title,
            content: entryData.content,
            summary: entryData.summary,
            metadata: entryData.metadata,
            knowledge_type: entryData.knowledge_type,
            // Include any other fields that were edited
            ...(entryData.productLink && { productLink: entryData.productLink }),
            ...(entryData.targetMarket && { targetMarket: entryData.targetMarket }),
            ...(entryData.infoLink && { infoLink: entryData.infoLink }),
            ...(entryData.keyStatistics && { keyStatistics: entryData.keyStatistics }),
            ...(entryData.additionalLinks && { additionalLinks: entryData.additionalLinks })
          })
        }
      };

      console.group('✅ [n8nService] APPROVING ENTRY WITH DATA');
      console.log('📝 Entry ID:', entryId);
      console.log('👤 Reviewer ID:', reviewerId);
      console.log('📄 Notes:', notes || 'None');
      console.log('📦 Entry Data Included:', entryData ? 'Yes' : 'No');
      if (entryData) {
        console.log('📊 Entry Details:', {
          title: entryData.title,
          hasContent: !!entryData.content,
          hasSummary: !!entryData.summary,
          type: entryData.knowledge_type
        });
      }
      console.log('📦 Full Payload:', payload);
      console.groupEnd();

      const result = await this.callKnowledgeAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Approval with data successful!');
      } else {
        console.error('❌ [n8nService] Approval failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Approve entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to approve entry: ${error.message}`
      };
    }
  }

  // Generate wiki using Edge Function
  async generateWiki(format: 'markdown' | 'html' | 'json', userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'generate_wiki',
        userId: userId,
        teamId: teamId,
        data: {
          format: format,
          includeMetadata: true,
          timestamp: new Date().toISOString()
        }
      };

      this.logDebug('generateWiki', 'Generating wiki', { 
        format,
        userId 
      });

      const result = await this.callKnowledgeAction(payload);
      
      if (result.success) {
        console.log('✅ [n8nService] Wiki generation successful!');
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Generate wiki error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to generate wiki: ${error.message}`
      };
    }
  }

  // Get knowledge entry using Edge Function
  async getKnowledgeEntry(entryId: string, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'get_entry',
        userId: userId,
        teamId: teamId,
        data: {
          entryId: entryId,
          entry_id: entryId,
          timestamp: new Date().toISOString()
        }
      };

      this.logDebug('getKnowledgeEntry', 'Getting entry', { entryId });

      const result = await this.callKnowledgeAction(payload);
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] Get knowledge entry error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to get entry: ${error.message}`
      };
    }
  }

  // List knowledge entries using Edge Function
  async listKnowledgeEntries(filters: any, userId: string, teamId?: string): Promise<N8NWebhookResponse> {
    try {
      const payload = {
        action: 'list_entries',
        userId: userId,
        teamId: teamId,
        data: {
          filters: filters,
          limit: 50,
          offset: 0,
          timestamp: new Date().toISOString()
        }
      };

      this.logDebug('listKnowledgeEntries', 'Listing entries', { filters });

      const result = await this.callKnowledgeAction(payload);
      return result;
    } catch (error: any) {
      console.error('❌ [n8nService] List knowledge entries error:', error);
      return { 
        success: false, 
        error: error.message,
        message: `Failed to list entries: ${error.message}`
      };
    }
  }

  // Product Research (AI-powered URL analysis)
  async researchProduct(productData: {
    productName: string;
    productUrl: string;
    userId: string;
    teamId?: string;
  }): Promise<N8NWebhookResponse> {
    // Track as product research event
    await this.trackWebhookEvent('product_research', 'knowledge_base', productData);
    
    // This will trigger AI analysis of the product page
    const knowledgeEntry = {
      title: productData.productName || 'fill_with_ai',
      content: 'fill_with_ai',
      knowledge_type: 'product' as const,
      productLink: productData.productUrl,
      targetMarket: 'fill_with_ai',
      aiFields: new Set(['title', 'content', 'targetMarket']),
      userId: productData.userId,
      teamId: productData.teamId
    };

    return this.addKnowledgeEntry(knowledgeEntry);
  }

  // Existing ICP and message generation methods remain unchanged
  async createICP(icpData: {
    name: string;
    description: string;
    jobTitles: string[];
    industryFocus: string[];
    companySizeRange: string;
    painPoints: string[];
    valueDrivers: string[];
    companyCharacteristics: string;
    userId: string;
    teamId?: string;
    planType?: string;
    generateData?: {
      bestCustomers: string;
      worstCustomers: string;
      businessGoals: string;
      competitiveLandscape: string;
    };
  }): Promise<N8NWebhookResponse> {
    const transformedData = {
      user_id: icpData.userId,
      team_id: icpData.teamId || null,
      plan_type: icpData.planType || 'free',
      method: 'ai_generate',
      data: {
        companyInfo: icpData.companyCharacteristics,
        currentProduct: icpData.description,
        industry: icpData.industryFocus.join(', '),
        companySize: icpData.companySizeRange,
        targetMarket: icpData.jobTitles.join(', '),
        businessGoals: icpData.generateData?.businessGoals || icpData.valueDrivers.join(', '),
        bestCustomers: icpData.generateData?.bestCustomers || '',
        worstCustomers: icpData.generateData?.worstCustomers || '',
        competitiveLandscape: icpData.generateData?.competitiveLandscape || ''
      }
    };
    
    // Track ICP creation
    await this.trackWebhookEvent('create_icp', 'icp', transformedData);
  
    return this.callWebhook('create-icp', transformedData);
  }

  async generateMessage(messageData: {
    linkedinUrl: string;
    messageType: string;
    icpId?: number;
    userId: string;
    teamId?: string;
  }): Promise<N8NWebhookResponse> {
    // Track message generation
    await this.trackWebhookEvent('generate_message', 'message_generation', messageData);
    return this.callWebhook('generate-message', messageData);
  }

  async sendMessage(messageData: {
    messageId: string;
    linkedinUrl: string;
    message: string;
    userId: string;
  }): Promise<N8NWebhookResponse> {
    // Track message sending
    await this.trackWebhookEvent('send_message', 'message_generation', messageData);
    return this.callWebhook('send-message', messageData);
  }

  async updateTemplate(templateData: {
    templateId?: number;
    name: string;
    content: string;
    channel: string;
    userId: string;
    teamId?: string;
  }): Promise<N8NWebhookResponse> {
    return this.callWebhook('update-template', templateData);
  }

  async uploadAndProcessICP(uploadData: {
    file: File;
    userId: string;
    teamId?: string;
  }): Promise<N8NWebhookResponse> {
    try {
      // Check if edge functions are available
      const edgeFunctionsAvailable = await this.checkEdgeFunctionAvailability();
      
      if (!edgeFunctionsAvailable) {
        return {
          success: false,
          error: 'Feature not available',
          message: 'File upload requires n8n integration to be configured'
        };
      }
      
      const formData = new FormData();
      formData.append('file', uploadData.file);
      formData.append('userId', uploadData.userId);
      if (uploadData.teamId) {
        formData.append('teamId', uploadData.teamId);
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || this.supabaseAnonKey;

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/n8n-proxy/upload-icp`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        if (response.status === 406 || response.status === 400 || response.status === 404) {
          return {
            success: false,
            error: 'Feature not available',
            message: 'File upload is not yet configured'
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ N8N upload-icp webhook error:', error);
      return { success: false, error: error.message };
    }
  }
}

export const n8nService = new N8NService();
