// src/services/unipileService.ts
import { supabase } from '@/integrations/supabase/client';

interface UnipileAuthResponse {
  success: boolean;
  data?: {
    url: string;
    token: string;
    expiresOn: string;
  };
  error?: string;
}

interface UnipileAccount {
  id: string;
  provider: string;
  username: string;
  status: string;
  metadata?: any;
}

class UnipileService {
  private supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

  /**
   * Generate a hosted auth link for LinkedIn connection
   */
  async generateAuthLink(userId: string, type: 'create' | 'reconnect' = 'create'): Promise<UnipileAuthResponse> {
    try {
      console.log('🔗 Generating Unipile auth link for user:', userId);

      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('User not authenticated');
      }

      const payload = {
        type,
        providers: ['LINKEDIN'],
        api_url: 'https://api.unipile.com', // This will be handled by Edge Function
        expiresOn: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        userId,
        success_url: `${window.location.origin}/auth/unipile/success`,
        failure_url: `${window.location.origin}/auth/unipile/failure`,
        webhook_url: `https://hagtgdeyvogjkcjwacla.supabase.co/functions/v1/server-unipile-callback`
      };

      // Call Supabase Edge Function instead of Unipile directly
      const response = await fetch(`${this.supabaseUrl}/functions/v1/unipile-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Unipile auth link generated:', result);

      return result;

    } catch (error: any) {
      console.error('❌ Failed to generate Unipile auth link:', error);

      // Fallback: Return demo URL for development
      if (import.meta.env.DEV) {
        console.log('🧪 Using demo URL for development');
        return {
          success: true,
          data: {
            url: 'https://demo.unipile.com/linkedin-auth?demo=true',
            token: 'demo-token',
            expiresOn: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to generate auth link'
      };
    }
  }

  /**
   * Check LinkedIn connection status for a user
   */
  async checkLinkedInStatus(userId: string): Promise<{ connected: boolean; account?: UnipileAccount }> {
    try {
      console.log('🔍 Checking LinkedIn status for user:', userId);

      // Check user_profiles for linkedin_connected status
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('linkedin_connected, linkedin_url, unipile_account_id, linkedin_profile_data')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      const connected = profile?.linkedin_connected || false;

      if (connected && profile?.unipile_account_id) {
        const linkedinData = profile.linkedin_profile_data as any;
        console.log('🔍 LinkedIn profile data:', { profile, linkedinData });

        // Extract data from the rich profile
        const firstName = linkedinData?.first_name || '';
        const lastName = linkedinData?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'LinkedIn User';
        const occupation = linkedinData?.occupation || '';
        const location = linkedinData?.location || '';
        const profilePictureUrl = linkedinData?.profile_picture_url || '';
        const publicIdentifier = linkedinData?.public_identifier || profile.linkedin_url || '';
        const organization = linkedinData?.organizations?.[0]?.name || '';

        // Construct full LinkedIn URL - use publicIdentifier from data or linkedin_url from database
        const identifier = publicIdentifier || profile.linkedin_url || '';
        const profileUrl = identifier ? `https://www.linkedin.com/in/${identifier}` : '';

        return {
          connected: true,
          account: {
            id: profile.unipile_account_id,
            provider: 'LINKEDIN',
            username: fullName,
            status: 'active',
            metadata: {
              profile_url: profileUrl,
              profile_picture_url: profilePictureUrl,
              occupation: occupation,
              location: location,
              organization: organization,
              first_name: firstName,
              last_name: lastName,
              public_identifier: publicIdentifier
            }
          }
        };
      }

      return { connected: false };

    } catch (error: any) {
      console.error('❌ Failed to check LinkedIn status:', error);
      return { connected: false };
    }
  }

  /**
   * Handle successful LinkedIn connection
   */
  async handleConnectionSuccess(userId: string, accountData: any): Promise<boolean> {
    try {
      console.log('🎉 Handling LinkedIn connection success:', { userId, accountData });

      // Update user profile with LinkedIn connection
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          linkedin_connected: true,
          unipile_account_id: accountData.id,
          linkedin_url: accountData.profile_url || '',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      console.log('✅ LinkedIn connection saved successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Failed to handle connection success:', error);
      return false;
    }
  }

  /**
   * Disconnect LinkedIn account
   */
  async disconnectLinkedIn(userId: string): Promise<boolean> {
    try {
      console.log('🔌 Disconnecting LinkedIn for user:', userId);

      // First, get the Unipile account ID so we can delete it
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('unipile_account_id')
        .eq('user_id', userId)
        .single();

      const unipileAccountId = profile?.unipile_account_id;

      // If there's a Unipile account, delete it from Unipile's platform
      if (unipileAccountId) {
        console.log('🗑️ Deleting Unipile account:', unipileAccountId);

        try {
          // Get current user session for auth
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          if (token) {
            // Call edge function to delete the account from Unipile
            const response = await fetch(`${this.supabaseUrl}/functions/v1/unipile-delete-account`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                account_id: unipileAccountId,
                user_id: userId
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.warn('⚠️ Failed to delete from Unipile (continuing with local disconnect):', errorText);
            } else {
              console.log('✅ Unipile account deleted successfully');
            }
          }
        } catch (unipileError: any) {
          // Log the error but continue with local disconnect
          console.warn('⚠️ Error deleting from Unipile (continuing with local disconnect):', unipileError);
        }
      }

      // Update user profile to remove LinkedIn connection (always do this, even if Unipile deletion fails)
      const { error } = await supabase
        .from('user_profiles')
        .update({
          linkedin_connected: false,
          unipile_account_id: null,
          linkedin_url: null,
          linkedin_profile_data: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ LinkedIn disconnected successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Failed to disconnect LinkedIn:', error);
      return false;
    }
  }
}

export const unipileService = new UnipileService();