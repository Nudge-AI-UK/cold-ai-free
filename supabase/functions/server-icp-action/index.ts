// supabase/functions/server-icp-action/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  let body = null;

  try {
    // Parse request body
    body = await req.json();
    const { action, userId, teamId, data } = body;

    // Get environment variables
    const N8N_ICP_WEBHOOK = Deno.env.get('N8N_ICP_WEBHOOK');
    const N8N_API_KEY = Deno.env.get('N8N_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('ICP action received:', {
      action,
      userId,
      timestamp: new Date().toISOString()
    });

    // ⚠️ SECURITY: Check LinkedIn connection before allowing AI-powered ICP operations
    // This prevents users from burning through OpenAI API costs before duplicate detection
    if (action !== 'test_connection') {
      // Initialize Supabase client for LinkedIn check
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing Supabase configuration');
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Check if user has LinkedIn connected
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('linkedin_connected, unipile_account_id')
        .eq('user_id', userId)
        .single();

      if (profileError || !userProfile) {
        console.error('❌ Failed to check LinkedIn status:', profileError);
        return new Response(JSON.stringify({
          success: false,
          error: 'LinkedIn verification required',
          message: 'Please connect your LinkedIn account to continue. This helps us prevent abuse and protect our AI resources.',
          requiresLinkedIn: true
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!userProfile.linkedin_connected || !userProfile.unipile_account_id) {
        console.warn('⚠️ User attempted ICP operation without LinkedIn connection:', userId);
        return new Response(JSON.stringify({
          success: false,
          error: 'LinkedIn connection required',
          message: 'Please connect your LinkedIn account before using AI-powered ICP features. This helps us prevent abuse and ensure fair usage.',
          requiresLinkedIn: true
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      console.log('✅ LinkedIn verification passed for user:', userId);
    }

    // Initialize Supabase client for database operations
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle test_connection action directly
    if (action === 'test_connection') {
      console.log('Test connection request received');

      if (N8N_ICP_WEBHOOK) {
        try {
          const testPayload = {
            action: 'test_connection',
            data: {
              test: true,
              timestamp: new Date().toISOString(),
              user_id: userId || 'test'
            }
          };

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          };

          if (N8N_API_KEY) {
            headers['X-API-Key'] = N8N_API_KEY;
          }

          const response = await fetch(N8N_ICP_WEBHOOK, {
            method: 'POST',
            headers,
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            return new Response(JSON.stringify({
              success: true,
              message: 'Successfully connected to n8n ICP webhook',
              details: {
                webhookConfigured: true,
                webhookResponding: true,
                timestamp: new Date().toISOString()
              }
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } else {
            return new Response(JSON.stringify({
              success: false,
              message: `n8n webhook returned status ${response.status}`,
              details: {
                webhookConfigured: true,
                webhookResponding: false,
                status: response.status
              }
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
        } catch (webhookError) {
          return new Response(JSON.stringify({
            success: false,
            message: 'n8n webhook is configured but not responding',
            details: {
              webhookConfigured: true,
              webhookResponding: false,
              error: (webhookError as Error).message
            }
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      } else {
        return new Response(JSON.stringify({
          success: false,
          message: 'N8N_ICP_WEBHOOK environment variable is not configured',
          details: {
            webhookConfigured: false
          }
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // Validate webhook configuration for other actions
    if (!N8N_ICP_WEBHOOK) {
      throw new Error('N8N_ICP_WEBHOOK is not configured');
    }

    // Transform payload for n8n
    const n8nPayload = {
      action,
      user_id: userId,
      team_id: teamId,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    };

    // Handle different ICP actions
    switch (action) {
      case 'create_icp':
        console.log('Creating ICP entry:', {
          icp_name: data.icp_name,
          user_id: userId
        });

        // Create entry in database first
        const { data: newICP, error: insertError } = await supabase
          .from('icps')
          .insert({
            icp_name: data.icp_name,
            description: data.description,
            job_titles: data.job_titles,
            pain_points: data.pain_points,
            value_drivers: data.value_drivers,
            industry_focus: data.industry_focus,
            company_characteristics: data.company_characteristics,
            product_link_id: data.product_link_id,
            metadata: data.metadata,
            created_by: userId,
            workflow_status: 'processing',
            review_status: 'pending'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Database insert error:', insertError);
          throw insertError;
        }

        console.log('Created ICP:', { id: newICP.id, name: newICP.icp_name });

        // Add ICP ID to payload for n8n
        n8nPayload.data.icp_id = newICP.id;
        n8nPayload.data.database_entry = newICP;
        break;

      case 'update_icp':
        // Update in database
        const { error: updateError } = await supabase
          .from('icps')
          .update({
            ...(data.updates || data),
            updated_at: new Date().toISOString()
          })
          .eq('id', data.icp_id)
          .eq('created_by', userId);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw updateError;
        }
        break;

      case 'archive_icp':
        // Soft delete in database
        const { error: archiveError } = await supabase
          .from('icps')
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', data.icp_id)
          .eq('created_by', userId);

        if (archiveError) {
          console.error('Database archive error:', archiveError);
          throw archiveError;
        }
        break;

      case 'restore_icp':
        // Restore archived entry
        const { error: restoreError } = await supabase
          .from('icps')
          .update({
            is_archived: false,
            archived_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.icp_id)
          .eq('created_by', userId);

        if (restoreError) {
          console.error('Database restore error:', restoreError);
          throw restoreError;
        }
        break;

      case 'submit_for_review':
        // Update status for review
        const { error: reviewError } = await supabase
          .from('icps')
          .update({
            workflow_status: 'reviewing',
            review_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', data.icp_id)
          .eq('created_by', userId);

        if (reviewError) {
          console.error('Database review error:', reviewError);
          throw reviewError;
        }
        break;

      case 'regenerate_icp':
        // Set status for regeneration
        const { error: regenError } = await supabase
          .from('icps')
          .update({
            workflow_status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', data.icp_id)
          .eq('created_by', userId);

        if (regenError) {
          console.error('Database regeneration error:', regenError);
          throw regenError;
        }
        break;
    }

    // Call n8n webhook for AI processing
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    };

    if (N8N_API_KEY) {
      headers['X-API-Key'] = N8N_API_KEY;
    }

    console.log('Calling n8n webhook:', {
      url: N8N_ICP_WEBHOOK,
      action,
      userId,
      hasData: !!n8nPayload.data.database_entry
    });

    const n8nResponse = await fetch(N8N_ICP_WEBHOOK, {
      method: 'POST',
      headers,
      body: JSON.stringify(n8nPayload)
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n webhook error:', errorText);

      return new Response(JSON.stringify({
        success: true,
        data: {
          icp_id: n8nPayload.data.icp_id,
          n8n_status: 'failed',
          n8n_error: `n8n responded with ${n8nResponse.status}: ${errorText}`
        },
        message: `ICP ${action} completed (n8n processing failed)`,
        warning: 'Database operation succeeded but n8n workflow failed to process'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    let n8nData = {};
    try {
      n8nData = await n8nResponse.json();
    } catch (e) {
      console.error('Failed to parse n8n response as JSON:', e);
      n8nData = { raw_response: await n8nResponse.text() };
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      data: {
        ...n8nData,
        icp_id: n8nPayload.data.icp_id
      },
      message: `ICP ${action} completed successfully`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('ICP action error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      details: {
        action: body?.action || 'unknown',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
