// ICP workflow status types matching the database enum
export type ICPWorkflowStatus = 
  | 'form'       // Initial user input
  | 'generating' // AI processing
  | 'draft'      // User can edit
  | 'reviewing'  // AI review/enhancement (locked)
  | 'approved'   // Live and ready for use
  | 'failed'     // Generation/review failed
  | 'archived';  // Soft deleted

export type ICPReviewStatus = 'pending' | 'approved' | 'rejected';

// Complete ICP interface with all fields including workflow status
export interface ICP {
  // Core fields
  id: number;
  team_id?: string;
  icp_name: string;
  description?: string;
  
  // Target characteristics
  job_titles?: string[];
  company_characteristics?: string;
  industry_focus?: string[];
  company_size_range?: string;
  geographic_focus?: string[];
  
  // Pain points and value
  pain_points?: string[];
  value_drivers?: string[];
  
  // Decision process
  budget_range?: string;
  decision_making_process?: string;
  objections_and_concerns?: string[];
  success_metrics?: string[];
  sales_cycle_length?: string;
  
  // Engagement
  preferred_communication_channels?: string[];
  technology_stack?: string[];
  competitive_alternatives?: string[];
  
  // Strategic fields for enhanced ICP generation
  buying_triggers?: string;
  champion_profile?: string;
  decision_criteria?: string;
  objection_patterns?: string;
  engagement_preference?: string;
  budget_authority?: string;
  target_company_maturity?: string;
  
  // Product relationship
  product_link_id?: string;
  product_id?: string;
  product_name?: string;
  
  // Workflow and status fields (NEW)
  workflow_status?: ICPWorkflowStatus;
  review_status?: ICPReviewStatus;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  metadata?: Record<string, any>;
  generation_attempts?: number;
  last_error?: string;
  deleted_at?: string;
  
  // Legacy status field (kept for backward compatibility)
  is_active?: boolean;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

// ICP creation form data (what user submits)
export interface ICPFormData {
  icp_title: string;
  product_id: string;
  target_company_maturity: string;
  buying_triggers: string;
  champion_profile: string;
  decision_criteria: string;
  objection_patterns: string;
  success_metrics: string;
  engagement_preference: string;
  budget_authority: string;
  competitive_alternatives: string;
}

// ICP action payload for edge function
export interface ICPActionPayload {
  action: 'test_connection' | 'create_icp' | 'update_icp' | 'submit_for_review' | 
          'approve_icp' | 'regenerate_icp' | 'archive_icp' | 'restore_icp';
  userId?: string;
  teamId?: string;
  data: Record<string, any>;
}

// ICP action response from edge function
export interface ICPActionResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  warning?: string;
  details?: any;
}

// Status display configuration
export interface ICPStatusDisplay {
  label: string;
  color: 'gray' | 'blue' | 'yellow' | 'purple' | 'green' | 'red';
  description: string;
  icon?: string;
  isLocked?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canSubmit?: boolean;
  canApprove?: boolean;
  canRegenerate?: boolean;
}

// Helper function to get status display configuration
export const getICPStatusDisplay = (status: ICPWorkflowStatus): ICPStatusDisplay => {
  const statusMap: Record<ICPWorkflowStatus, ICPStatusDisplay> = {
    'form': {
      label: 'Form',
      color: 'gray',
      description: 'Initial input',
      icon: 'file-text',
      isLocked: false,
      canEdit: true,
      canDelete: true,
      canSubmit: false,
      canApprove: false,
      canRegenerate: false
    },
    'generating': {
      label: 'Generating',
      color: 'blue',
      description: 'AI is creating your ICP...',
      icon: 'loader',
      isLocked: true,
      canEdit: false,
      canDelete: false,
      canSubmit: false,
      canApprove: false,
      canRegenerate: false
    },
    'draft': {
      label: 'Draft',
      color: 'yellow',
      description: 'Ready for editing',
      icon: 'edit',
      isLocked: false,
      canEdit: true,
      canDelete: true,
      canSubmit: true,
      canApprove: false,
      canRegenerate: false
    },
    'reviewing': {
      label: 'Reviewing',
      color: 'purple',
      description: 'AI is reviewing your ICP...',
      icon: 'eye',
      isLocked: true,
      canEdit: false,
      canDelete: false,
      canSubmit: false,
      canApprove: true,
      canRegenerate: false
    },
    'approved': {
      label: 'Approved',
      color: 'green',
      description: 'Live and ready to use',
      icon: 'check-circle',
      isLocked: false,
      canEdit: false,
      canDelete: true,
      canSubmit: false,
      canApprove: false,
      canRegenerate: false
    },
    'failed': {
      label: 'Failed',
      color: 'red',
      description: 'Generation failed',
      icon: 'alert-circle',
      isLocked: false,
      canEdit: false,
      canDelete: true,
      canSubmit: false,
      canApprove: false,
      canRegenerate: true
    },
    'archived': {
      label: 'Archived',
      color: 'gray',
      description: 'No longer active',
      icon: 'archive',
      isLocked: false,
      canEdit: false,
      canDelete: false,
      canSubmit: false,
      canApprove: false,
      canRegenerate: false
    }
  };

  return statusMap[status] || statusMap['form'];
};

// Check if ICP can transition to a new status
export const canTransitionTo = (
  currentStatus: ICPWorkflowStatus,
  targetStatus: ICPWorkflowStatus
): boolean => {
  const transitions: Record<ICPWorkflowStatus, ICPWorkflowStatus[]> = {
    'form': ['generating'],
    'generating': ['draft', 'failed'],
    'draft': ['reviewing', 'archived'],
    'reviewing': ['approved', 'draft'],
    'approved': ['archived'],
    'failed': ['generating', 'draft', 'archived'],
    'archived': ['draft']
  };

  return transitions[currentStatus]?.includes(targetStatus) || false;
};

// Character limits for ICP fields
export const ICP_FIELD_LIMITS = {
  icp_title: 60,
  description: 500,
  buying_triggers: 500,
  champion_profile: 500,
  decision_criteria: 500,
  objection_patterns: 500,
  success_metrics: 500,
  engagement_preference: 300,
  budget_authority: 300,
  competitive_alternatives: 300,
  company_characteristics: 500
};

// Subscription tier ICP limits
export const ICP_LIMITS_BY_TIER = {
  free: 1,
  basic: 5,
  standard: 10,
  pro: 25,
  team: 100
} as const;

export type SubscriptionTier = keyof typeof ICP_LIMITS_BY_TIER;
