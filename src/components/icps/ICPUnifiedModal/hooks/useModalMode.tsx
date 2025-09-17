import { useMemo } from 'react';

type ModalMode = 'edit' | 'review' | 'view';

interface ModalModeResult {
  mode: ModalMode;
  isEditable: boolean;
  shouldLoadMetadata: boolean;
  statusLabel: string;
  statusColor: string;
}

export const useModalMode = (icp: any): ModalModeResult => {
  return useMemo(() => {
    // Determine the ICP status
    const getStatus = () => {
      if (icp.workflow_status === 'generating') {
        return 'generating';
      }
      if (icp.workflow_status === 'processing' || icp.workflow_status === 'reviewing') {
        return 'reviewing';  // This catches ALL reviewing states
      }
      if (icp.workflow_status === 'approved') {
        return 'live';  // Simplified - if approved, it's live
      }
      if (icp.workflow_status === 'draft' || !icp.workflow_status) {
        return 'draft';
      }
      
      return 'draft';  // Default
    };  // ← FIXED: Removed extra closing brace here
    
    const status = getStatus();
    
    // Determine mode based on status
    let mode: ModalMode;
    let isEditable = false;
    let shouldLoadMetadata = false;
    let statusLabel = '';
    let statusColor = '';
    
    switch (status) {
      case 'draft':
        mode = 'edit';
        isEditable = true;
        shouldLoadMetadata = true; // Load metadata if exists (from previous processing)
        statusLabel = 'Draft - Needs Review';
        statusColor = 'yellow';
        break;
        
      case 'reviewing':
      case 'processing':
        mode = 'review';
        isEditable = false;
        shouldLoadMetadata = false; // CRITICAL: Never load metadata during reviewing
        statusLabel = 'Reviewing';
        statusColor = 'blue';
        break;
        
      case 'live':
      case 'active':
        mode = 'view';
        isEditable = false;
        shouldLoadMetadata = true; // Always load metadata for active ICPs
        statusLabel = 'Active';
        statusColor = 'green';
        break;
        
      case 'generating':
        // This shouldn't happen as generating ICPs shouldn't open modal
        mode = 'review';
        isEditable = false;
        shouldLoadMetadata = false;
        statusLabel = 'Generating';
        statusColor = 'purple';
        break;
        
      default:
        mode = 'view';
        isEditable = false;
        shouldLoadMetadata = false;
        statusLabel = 'Unknown';
        statusColor = 'gray';
    }
    
    // Special case: If ICP has is_active flag, it's definitely live
    if (icp.is_active) {
      mode = 'view';
      isEditable = false;
      shouldLoadMetadata = true;
      statusLabel = 'Active';
      statusColor = 'green';
    }
    
    // Special case: If review_status is pending and workflow_status is not approved
    if (icp.review_status === 'pending' && icp.workflow_status !== 'approved') {
      mode = 'edit';
      isEditable = true;
      shouldLoadMetadata = true;
      statusLabel = 'Draft - Needs Review';
      statusColor = 'yellow';
    }
    
    return {
      mode,
      isEditable,
      shouldLoadMetadata,
      statusLabel,
      statusColor
    };
  }, [icp]);
};
