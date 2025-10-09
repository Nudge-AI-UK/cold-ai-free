import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Info,
  Target,
  Building,
  Users,
  MessageSquare,
  Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Import sub-components
import { AIFeedbackPanel } from './components/AIFeedbackPanel';
import { ICPTabs } from './components/ICPTabs';
import { ReviewingIndicator } from './components/ReviewingIndicator';
import { useICPData } from './hooks/useICPData';
import { useChangeDetection } from './hooks/useChangeDetection';
import { useModalMode } from './hooks/useModalMode';

interface ICPUnifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  icp: any; // We'll type this properly based on your ICP type
  onUpdate?: () => void;
  mode?: string; // Add mode prop for the modal flow system
  renderWithoutDialog?: boolean; // Add flag to render without Dialog wrapper
}

export const ICPUnifiedModal: React.FC<ICPUnifiedModalProps> = ({
  isOpen,
  onClose,
  icp,
  onUpdate,
  mode: propMode,
  renderWithoutDialog = false
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Generate unique approval request ID when modal opens
  const [approvalRequestId] = useState(() => crypto.randomUUID());
  
  // Track if approval is in progress to prevent double-clicks
  const [isApproving, setIsApproving] = useState(false);
  
  // Determine modal mode based on ICP status or use provided mode
  const { mode: autoMode, isEditable, shouldLoadMetadata } = useModalMode(icp);
  const mode = propMode || autoMode;
  
  // Load ICP data with conditional metadata loading
  const { formData, setFormData, metadata, isDataLoading } = useICPData(
    icp, 
    shouldLoadMetadata
  );
  
  // Track changes for edit mode
  const { hasChanges, changedFields, resetChanges } = useChangeDetection(
    icp,
    formData,
    mode === 'edit'
  );

  // Get status display info
  const getStatusBadge = () => {
    switch (mode) {
      case 'edit':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <AlertCircle className="w-3 h-3 mr-1" />
            Draft - Needs Review
          </Badge>
        );
      case 'review':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Reviewing
          </Badge>
        );
      case 'view':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
    }
  };

  // Handle approval for draft ICPs
  const handleApprove = async () => {
    // Prevent multiple clicks
    if (isApproving) {
      console.log('Approval already in progress, ignoring click');
      return;
    }

    const userId = user?.id;
    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    setIsApproving(true);
    try {
      // 1. Save the edited/approved data to icps table with reviewing status
      const { error: updateError } = await supabase
        .from('icps')
        .update({
          ...formData,
          workflow_status: 'reviewing',
          review_status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', icp.id);

      if (updateError) throw updateError;

      // 2. Create webhook event with original data, AI suggestions, and changed fields
      const webhookPayload = {
        user_id: user?.id,
        event_type: 'icp_review',
        idempotency_key: approvalRequestId,  // Add idempotency key here
        payload: {
          icp_id: icp.id,
          original_data: icp,                    // Original draft ICP (before edits)
          ai_suggestions: metadata?.ai_feedback,  // Original AI suggestions if they exist
          changed_fields: changedFields,          // List of field names that changed
          approved_at: new Date().toISOString()
        },
        status: 'pending',
        processed: false,
        retry_count: 0,
        created_at: new Date().toISOString()
      };

      const { error: webhookError } = await supabase
        .from('webhook_events')
        .insert(webhookPayload);

      if (webhookError) throw webhookError;

      toast.success('ICP approved and sent for review!');
      onUpdate?.();
      onClose();
    } catch (error: any) {
      console.error('Error approving ICP:', error);
      
      // Check if it's a duplicate key error
      if (error.message?.includes('duplicate') || error.code === '23505') {
        toast.error('This approval is already being processed');
      } else {
        toast.error(error.message || 'Failed to approve ICP');
      }
    } finally {
      setIsApproving(false);
    }
  };

  // Handle save for draft edits (without approval)
  const handleSave = async () => {
    if (!isEditable) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('icps')
        .update(formData)
        .eq('id', icp.id);

      if (error) throw error;

      toast.success('Changes saved successfully');
      resetChanges();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error saving ICP:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Modal title based on mode
  const getModalTitle = () => {
    const titles = {
      edit: 'Review & Approve ICP',
      review: 'ICP Under Review',
      view: 'ICP Details'
    };
    return titles[mode];
  };

  // Tab configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'targeting', label: 'Targeting', icon: Users },
    { id: 'company', label: 'Company', icon: Building },
    { id: 'engagement', label: 'Engagement', icon: MessageSquare },
    { id: 'messaging', label: 'Messaging', icon: MessageSquare },
    { id: 'insights', label: 'Insights', icon: Lightbulb }
  ];

  // Add personas tab for view mode
  if (mode === 'view' && metadata?.personas?.length > 0) {
    tabs.push({ id: 'personas', label: 'Personas', icon: Users });
  }

  // Define the modal content
  const modalContent = (
    <div className={`${renderWithoutDialog ? 'w-full h-full' : 'max-w-[95vw] w-[1400px] h-[90vh]'} bg-gray-900 border-gray-700 p-0 flex flex-col rounded-lg`}>
        {/* Header */}
        {renderWithoutDialog ? (
          <div className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-white">
                  {getModalTitle()}
                </h2>
                {getStatusBadge()}
                {hasChanges && (
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                    {changedFields.length} unsaved changes
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ) : (
          <DialogHeader className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <DialogTitle className="text-xl font-semibold text-white">
                  {getModalTitle()}
                </DialogTitle>
                {getStatusBadge()}
                {hasChanges && (
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                    {changedFields.length} unsaved changes
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto">
            {mode === 'review' ? (
              <ReviewingIndicator 
                icpName={icp.icp_name}
                description="Your ICP is being reviewed and enriched with AI-powered insights. The metadata is being regenerated based on your approved changes."
              />
            ) : (
              <ICPTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                formData={formData}
                setFormData={setFormData}
                isEditable={isEditable}
                changedFields={changedFields}
                metadata={metadata}
                mode={mode}
              />
            )}
          </div>

          {/* AI Feedback Panel - NOT shown during review mode */}
          {(mode === 'edit' || (mode === 'view' && metadata)) && (
            <AIFeedbackPanel
              metadata={metadata}
              mode={mode}
              formData={formData}
              onSuggestionApply={mode === 'edit' ? setFormData : undefined}
            />
          )}
        </div>

       {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {mode === 'edit' && (
              <>
                <Info className="w-4 h-4" />
                <span>Review the ICP details and AI suggestions before approving</span>
              </>
            )}
            {mode === 'review' && (
              <>
                <Clock className="w-4 h-4" />
                <span>AI is reviewing your approved changes and generating new insights</span>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            >
              Close
            </Button>

            {mode === 'edit' && (
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve & Review
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
    </div>
  );

  // Conditionally render with or without Dialog wrapper
  if (renderWithoutDialog) {
    return modalContent;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] bg-gray-900 border-gray-700 p-0 flex flex-col">
        {modalContent}
      </DialogContent>
    </Dialog>
  );
};

export default ICPUnifiedModal;
