import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Knowledge Base action types
export type KnowledgeAction = 
  // Entry Management
  | 'add_entry' | 'update_entry' | 'delete_entry' | 'get_entry' | 'list_entries'
  // Review Process
  | 'submit_review' | 'approve_entry' | 'reject_entry' | 'request_changes'
  // Wiki Operations
  | 'generate_wiki' | 'publish_wiki' | 'update_toc'
  // AI Enhancement
  | 'enhance_entry' | 'extract_metadata' | 'generate_summary'
  // Testing
  | 'test_connection';

export interface KnowledgeEntry {
  id?: string;
  title: string;
  content: string;
  knowledge_type: 'product' | 'company' | 'case_study';
  metadata?: {
    productLink?: string;
    targetMarket?: string;
    infoLink?: string;
    keyStatistics?: string;
    additionalLinks?: Array<{ id: string; title: string; url: string; }>;
    tags?: string[];
    enhanced?: boolean;
    summary?: string;
    extracted_metadata?: any;
    aiFields?: string[];
    aiFieldsRequested?: boolean;
  };
  status?: 'draft' | 'review' | 'approved' | 'published';
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface KnowledgeActionPayload {
  action: KnowledgeAction;
  data?: any;
  userId?: string;
  teamId?: string;
}

export interface KnowledgeActionResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  job_id?: string;
  async?: boolean;
  details?: any;
}

class KnowledgeBaseService {
  private baseUrl: string;

  constructor() {
    // Get the Supabase URL and construct the Edge Function URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    // Use the dedicated server-knowledge-action edge function
    this.baseUrl = `${supabaseUrl}/functions/v1/server-knowledge-action`;
  }

  /**
   * Execute a knowledge base action via n8n
   */
  private async executeAction(
    action: KnowledgeAction,
    data: any = {}
  ): Promise<KnowledgeActionResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session && action !== 'test_connection') {
        throw new Error('You must be logged in to perform this action');
      }

      // Get token - use anon key for test_connection
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const payload: KnowledgeActionPayload = {
        action,
        userId: session?.user?.id || 'test',
        data
      };

      console.log('[knowledgeBase.service] Executing action:', {
        action,
        url: this.baseUrl,
        userId: payload.userId
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('[knowledgeBase.service] Response:', {
        status: response.status,
        text: responseText
      });

      if (!response.ok) {
        throw new Error(responseText || `Request failed with status ${response.status}`);
      }

      const result = JSON.parse(responseText);
      return result;
    } catch (error) {
      console.error(`[knowledgeBase.service] Action ${action} failed:`, error);
      throw error;
    }
  }

  // Test connection method
  async testConnection(): Promise<KnowledgeActionResponse> {
    return await this.executeAction('test_connection', {
      test: true,
      timestamp: new Date().toISOString()
    });
  }

  // Entry Management Methods
  async addEntry(entry: KnowledgeEntry): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('add_entry', entry);
    
    if (response.success) {
      toast({
        title: "Entry Added",
        description: entry.metadata?.aiFieldsRequested 
          ? "Entry added. AI is generating the requested content..."
          : "Knowledge base entry has been added successfully"
      });
    }
    
    return response;
  }

  async updateEntry(entryId: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('update_entry', {
      entry_id: entryId,
      entryId: entryId, // Support both formats
      ...updates
    });
    
    if (response.success) {
      toast({
        title: "Entry Updated",
        description: "Knowledge base entry has been updated successfully"
      });
    }
    
    return response;
  }

  async deleteEntry(entryId: string): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('delete_entry', {
      entry_id: entryId,
      entryId: entryId // Support both formats
    });
    
    if (response.success) {
      toast({
        title: "Entry Deleted",
        description: "Knowledge base entry has been removed"
      });
    }
    
    return response;
  }

  async getEntry(entryId: string): Promise<KnowledgeActionResponse> {
    return await this.executeAction('get_entry', {
      entry_id: entryId,
      entryId: entryId
    });
  }

  async listEntries(filters?: any, limit = 50, offset = 0): Promise<KnowledgeActionResponse> {
    return await this.executeAction('list_entries', {
      filters,
      limit,
      offset
    });
  }

  // Review Process Methods
  async submitForReview(entryId: string, notes?: string): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('submit_review', {
      entry_id: entryId,
      entryId: entryId,
      review_notes: notes
    });
    
    if (response.success) {
      toast({
        title: "Submitted for Review",
        description: "Entry has been submitted for review"
      });
    }
    
    return response;
  }

  async approveEntry(entryId: string, reviewerId: string, notes?: string): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('approve_entry', {
      entry_id: entryId,
      entryId: entryId,
      reviewer_id: reviewerId,
      review_notes: notes
    });
    
    if (response.success) {
      toast({
        title: "Entry Approved",
        description: "Knowledge base entry has been approved"
      });
    }
    
    return response;
  }

  async rejectEntry(entryId: string, reviewerId: string, notes: string): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('reject_entry', {
      entry_id: entryId,
      entryId: entryId,
      reviewer_id: reviewerId,
      review_notes: notes
    });
    
    if (response.success) {
      toast({
        title: "Entry Rejected",
        description: "Knowledge base entry has been rejected"
      });
    }
    
    return response;
  }

  async requestChanges(entryId: string, reviewerId: string, notes: string): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('request_changes', {
      entry_id: entryId,
      entryId: entryId,
      reviewer_id: reviewerId,
      review_notes: notes
    });
    
    if (response.success) {
      toast({
        title: "Changes Requested",
        description: "Changes have been requested for this entry"
      });
    }
    
    return response;
  }

  // Wiki Operations Methods
  async generateWiki(format: 'markdown' | 'html' | 'json' = 'markdown'): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('generate_wiki', {
      format,
      include_metadata: true
    });
    
    if (response.success) {
      toast({
        title: "Wiki Generated",
        description: "Knowledge base wiki has been generated"
      });
    }
    
    return response;
  }

  async publishWiki(): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('publish_wiki', {
      format: 'markdown',
      include_metadata: true
    });
    
    if (response.success) {
      toast({
        title: "Wiki Published",
        description: "Knowledge base wiki has been published"
      });
    }
    
    return response;
  }

  async updateTableOfContents(): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('update_toc', {});
    
    if (response.success) {
      toast({
        title: "Table of Contents Updated",
        description: "Wiki table of contents has been updated"
      });
    }
    
    return response;
  }

  // AI Enhancement Methods
  async enhanceEntry(entryId: string, options?: any): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('enhance_entry', {
      entry_id: entryId,
      entryId: entryId,
      ai_model: 'gpt-4',
      enhancement_options: options || {}
    });
    
    if (response.async && response.job_id) {
      toast({
        title: "Enhancement Started",
        description: "AI enhancement has been queued. This may take a few moments."
      });
    } else if (response.success) {
      toast({
        title: "Entry Enhanced",
        description: "AI enhancement completed successfully"
      });
    }
    
    return response;
  }

  async extractMetadata(entryId: string): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('extract_metadata', {
      entry_id: entryId,
      entryId: entryId,
      ai_model: 'gpt-4'
    });
    
    if (response.async && response.job_id) {
      toast({
        title: "Metadata Extraction Started",
        description: "Processing entry metadata. This may take a few moments."
      });
    } else if (response.success) {
      toast({
        title: "Metadata Extracted",
        description: "Entry metadata has been extracted"
      });
    }
    
    return response;
  }

  async generateSummary(entryId: string): Promise<KnowledgeActionResponse> {
    const response = await this.executeAction('generate_summary', {
      entry_id: entryId,
      entryId: entryId,
      ai_model: 'gpt-4'
    });
    
    if (response.async && response.job_id) {
      toast({
        title: "Summary Generation Started",
        description: "Generating AI summary. This may take a few moments."
      });
    } else if (response.success) {
      toast({
        title: "Summary Generated",
        description: "AI summary has been generated"
      });
    }
    
    return response;
  }

  // Job Status Checking (for async operations)
  async checkJobStatus(jobId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('automation_jobs')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking job status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const knowledgeBaseService = new KnowledgeBaseService();

// Export convenience functions
export const knowledgeBase = {
  // Connection testing
  testConnection: () => knowledgeBaseService.testConnection(),
  
  // Entry Management
  add: (entry: KnowledgeEntry) => knowledgeBaseService.addEntry(entry),
  update: (id: string, updates: Partial<KnowledgeEntry>) => knowledgeBaseService.updateEntry(id, updates),
  delete: (id: string) => knowledgeBaseService.deleteEntry(id),
  get: (id: string) => knowledgeBaseService.getEntry(id),
  list: (filters?: any, limit?: number, offset?: number) => knowledgeBaseService.listEntries(filters, limit, offset),
  
  // Review Process
  submitReview: (id: string, notes?: string) => knowledgeBaseService.submitForReview(id, notes),
  approve: (id: string, reviewerId: string, notes?: string) => knowledgeBaseService.approveEntry(id, reviewerId, notes),
  reject: (id: string, reviewerId: string, notes: string) => knowledgeBaseService.rejectEntry(id, reviewerId, notes),
  requestChanges: (id: string, reviewerId: string, notes: string) => knowledgeBaseService.requestChanges(id, reviewerId, notes),
  
  // Wiki Operations
  generateWiki: (format?: 'markdown' | 'html' | 'json') => knowledgeBaseService.generateWiki(format),
  publishWiki: () => knowledgeBaseService.publishWiki(),
  updateTOC: () => knowledgeBaseService.updateTableOfContents(),
  
  // AI Enhancement
  enhance: (id: string, options?: any) => knowledgeBaseService.enhanceEntry(id, options),
  extractMetadata: (id: string) => knowledgeBaseService.extractMetadata(id),
  generateSummary: (id: string) => knowledgeBaseService.generateSummary(id),
  
  // Job Status
  checkJob: (jobId: string) => knowledgeBaseService.checkJobStatus(jobId)
};
