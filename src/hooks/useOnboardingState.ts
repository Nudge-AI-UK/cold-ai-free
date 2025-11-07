import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { unipileService } from '@/services/unipileService';

export type OnboardingStep = 'settings' | 'product' | 'icp' | 'linkedin' | 'complete';

interface OnboardingStatus {
  settings: {
    personal: boolean;
    company: boolean;
    communication: boolean;
  };
  product: boolean;
  icp: boolean;
  linkedin: boolean;
}

interface OnboardingState {
  currentStep: OnboardingStep;
  status: OnboardingStatus;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const useOnboardingState = (): OnboardingState => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<OnboardingStatus>({
    settings: {
      personal: false,
      company: false,
      communication: false,
    },
    product: false,
    icp: false,
    linkedin: false,
  });

  const checkOnboardingStatus = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const userId = user?.id || user?.user_id;

      // Check user profiles
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Check business profiles
      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Check communication preferences
      const { data: commPrefs } = await supabase
        .from('communication_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Check knowledge base (product)
      const { data: knowledgeBase } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('created_by', userId)
        .in('workflow_status', ['reviewing', 'active'])
        .eq('review_status', 'approved')
        .limit(1)
        .single();

      // Check ICPs
      const { data: icp } = await supabase
        .from('icps')
        .select('*')
        .eq('created_by', userId)
        .limit(1)
        .single();

      // Check LinkedIn connection
      const linkedinStatus = await unipileService.checkLinkedInStatus(userId);

      const newStatus: OnboardingStatus = {
        settings: {
          personal: !!userProfile,
          company: !!businessProfile,
          communication: !!commPrefs,
        },
        product: !!knowledgeBase && knowledgeBase.review_status === 'approved',
        icp: !!icp && (
          (icp.workflow_status === 'reviewing' && icp.review_status === 'approved') ||
          icp.is_active === true
        ),
        linkedin: linkedinStatus.connected,
      };

      setStatus(newStatus);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  // Determine current step based on status
  const getCurrentStep = (): OnboardingStep => {
    const { settings, product, icp, linkedin } = status;
    const settingsComplete = settings.personal && settings.company && settings.communication;

    if (!settingsComplete) {
      return 'settings';
    }
    if (!product) {
      return 'product';
    }
    if (!icp) {
      return 'icp';
    }
    if (!linkedin) {
      return 'linkedin';
    }
    return 'complete';
  };

  return {
    currentStep: getCurrentStep(),
    status,
    isLoading,
    refresh: checkOnboardingStatus,
  };
};
