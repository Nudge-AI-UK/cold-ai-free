import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SimpleSubscription {
  subscription_id: string;
  plan_type: string;
  status: string;
  billing_email: string;
  max_teams_allowed: number;
  teams_created: number;
}

export interface SimpleTeamMembership {
  id: number;
  team_id: string;
  role: string;
  status: string;
}

export const useSimpleSubscription = (userId?: string) => {
  const [subscription, setSubscription] = useState<SimpleSubscription | null>(null);
  const [teamMembership, setTeamMembership] = useState<SimpleTeamMembership | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionData = async () => {
    if (!userId) {
      setSubscription(null);
      setTeamMembership(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 Fetching subscription for user:', userId);

      // Get user email first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        console.warn('⚠️ No user email found');
        return;
      }

      // Fetch subscription data by billing email
      const { data: subscriptionData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('billing_email', user.email)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        console.warn('⚠️ Subscription fetch error:', subError);
      }

      // Fetch team membership - use maybeSingle() since team membership is optional
      const { data: teamData, error: teamError } = await supabase
        .from('team_memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(); // Changed from .single() to .maybeSingle()

      if (teamError) {
        console.log('ℹ️ No team membership found - user is on individual plan');
      }

      setSubscription(subscriptionData || null);
      setTeamMembership(teamData || null);
      
      console.log('✅ Subscription data loaded:', {
        hasSubscription: !!subscriptionData,
        hasTeam: !!teamData,
        planType: subscriptionData?.plan_type || 'free'
      });

    } catch (err: any) {
      console.error('❌ Error fetching subscription:', err);
      setError(err.message);
      // Set defaults on error
      setSubscription(null);
      setTeamMembership(null);
    } finally {
      setIsLoading(false);
    }
  };

  const isTeamUser = () => {
    return teamMembership !== null;
  };

  const isTeamPlan = () => {
    return subscription?.plan_type?.includes('team') || false;
  };

  const getPlanType = () => {
    return subscription?.plan_type || 'free';
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, [userId]);

  return {
    subscription,
    teamMembership,
    isLoading,
    error,
    refetch: fetchSubscriptionData,
    isTeamUser: isTeamUser(),
    isTeamPlan: isTeamPlan(),
    planType: getPlanType()
  };
};