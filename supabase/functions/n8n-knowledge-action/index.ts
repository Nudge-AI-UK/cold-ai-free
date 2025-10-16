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

  // Store the parsed body to avoid reading it multiple times
  let body = null;

  try {
    // Parse request body once
    body = await req.json();
    const { action, userId, teamId, data } = body;

    // Get environment variables
    const N8N_KNOWLEDGE_WEBHOOK = Deno.env.get('N8N_KNOWLEDGE_WEBHOOK');
    const N8N_API_KEY = Deno.env.get('N8N_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Knowledge action received:', {
      action,
      userId,
      timestamp: new Date().toISOString()
    });

    // Handle test_connection action directly
    if (action === 'test_connection') {
      console.log('Test connection request received');

      if (N8N_KNOWLEDGE_WEBHOOK) {
        try {
          // Try to ping the n8n webhook
          const testPayload = {
            action: 'test_connection',
            data: {
              test: true,
              timestamp: new Date().toISOString(),
              user_id: userId || 'test'
            }
          };

          const headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          };

          if (N8N_API_KEY) {
            headers['X-API-Key'] = N8N_API_KEY;
          }

          const response = await fetch(N8N_KNOWLEDGE_WEBHOOK, {
            method: 'POST',
            headers,
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });

          if (response.ok) {
            return new Response(JSON.stringify({
              success: true,
              message: 'Successfully connected to n8n Knowledge Base webhook',
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
              error: webhookError.message
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
          message: 'N8N_KNOWLEDGE_WEBHOOK environment variable is not configured',
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

    // Check Supabase configuration for database operations
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    // Validate webhook configuration for other actions
    if (!N8N_KNOWLEDGE_WEBHOOK) {
      throw new Error('N8N_KNOWLEDGE_WEBHOOK is not configured');
    }

    // Initialize Supabase client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Special handling for different actions
    switch (action) {
      case 'add_entry':
        // Handle simplified payload from frontend (just URL + knowledge_type)
        // Title and content will be undefined - generate placeholders
        const title = (!data.title || data.title === 'fill_with_ai')
          ? `AI Generated - ${new Date().toISOString()}`
          : data.title;

        const content = (!data.content || data.content === 'fill_with_ai')
          ? 'Generating content...'
          : data.content;

        // Build metadata with productLink
        const metadata = {
          ...(data.metadata || {}),
          source_info: {
            research_url: data.productLink,
            url: data.productLink,
            original_url: data.productLink,
            productLink: data.productLink
          },
          aiGenerated: true,
          sourceUrl: data.productLink,
          generated_at: new Date().toISOString()
        };

        console.log('Creating knowledge base entry:', {
          title,
          knowledge_type: data.knowledgeType || data.knowledge_type,
          has_productLink: !!data.productLink
        });

        // Create entry in database first
        const { data: newEntry, error: insertError } = await supabase
          .from('knowledge_base')
          .insert({
            title,
            content,
            knowledge_type: data.knowledgeType || data.knowledge_type,
            metadata,
            created_by: userId,
            workflow_status: 'processing'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Database insert error:', insertError);
          throw insertError;
        }

        console.log('Created entry:', { id: newEntry.id, title: newEntry.title });

        // Add entry ID to payload for n8n
        n8nPayload.data.entry_id = newEntry.id;
        n8nPayload.data.database_entry = newEntry;
        break;

      case 'update_entry':
        // Update in database
        const { error: updateError } = await supabase
          .from('knowledge_base')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.entryId || data.entry_id)
          .eq('created_by', userId);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw updateError;
        }
        break;

      case 'approve_entry':
        // Handle approval with potential content updates
        const entryId = data.entryId || data.entry_id;

        console.log('Processing approve_entry:', {
          entryId,
          hasContentUpdates: !!(data.title || data.content || data.summary),
          reviewerId: data.reviewerId,
          reviewNotes: data.reviewNotes
        });

        // Prepare update object with content changes
        const updateData = {
          workflow_status: 'reviewing',
	  review_status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: data.reviewerId || userId,
          updated_at: new Date().toISOString()
        };

        // Include content updates if provided
        if (data.title) updateData.title = data.title;
        if (data.content) updateData.content = data.content;
        if (data.summary) updateData.summary = data.summary;

        // Update metadata if provided
        if (data.metadata) {
          // Fetch existing metadata to merge
          const { data: existingEntry } = await supabase
            .from('knowledge_base')
            .select('metadata')
            .eq('id', entryId)
            .single();

          updateData.metadata = {
            ...existingEntry?.metadata || {},
            ...data.metadata,
            review_started_at: new Date().toISOString(),
            reviewed_by: data.reviewerId || userId,
            review_notes: data.reviewNotes
          };
        }

        // Apply the update
        const { data: approvedEntry, error: approveError } = await supabase
          .from('knowledge_base')
          .update(updateData)
          .eq('id', entryId)
          .select()
          .single();

        if (approveError) {
          console.error('Database approve error:', approveError);
          throw approveError;
        }

        // Add full entry data to n8n payload
        n8nPayload.data.entry_id = entryId;
        n8nPayload.data.database_entry = approvedEntry;
        n8nPayload.data.updates_applied = updateData;
        n8nPayload.data.review_notes = data.reviewNotes;
        break;

      case 'delete_entry':
        // Soft delete in database
        const { error: deleteError } = await supabase
          .from('knowledge_base')
          .update({
            deleted_at: new Date().toISOString(),
            can_restore_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
          })
          .eq('id', data.entryId || data.entry_id)
          .eq('created_by', userId);

        if (deleteError) {
          console.error('Database delete error:', deleteError);
          throw deleteError;
        }
        break;

      case 'restore_entry':
        // Restore soft-deleted entry
        const { error: restoreError } = await supabase
          .from('knowledge_base')
          .update({
            deleted_at: null,
            can_restore_until: null,
            workflow_status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', data.entryId || data.entry_id);

        if (restoreError) {
          console.error('Database restore error:', restoreError);
          throw restoreError;
        }
        break;

      case 'generate_wiki':
        // Set status for wiki generation
        const { error: wikiError } = await supabase
          .from('knowledge_base')
          .update({
            workflow_status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('created_by', userId)
          .eq('review_status', 'approved');

        if (wikiError) {
          console.error('Database wiki status error:', wikiError);
          // Don't throw - wiki generation can proceed anyway
        }
        break;
    }

    // Call n8n webhook for workflow processing
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    };

    if (N8N_API_KEY) {
      headers['X-API-Key'] = N8N_API_KEY;
    }

    console.log('Calling n8n webhook:', {
      url: N8N_KNOWLEDGE_WEBHOOK,
      action,
      userId,
      hasData: !!n8nPayload.data.database_entry
    });

    const n8nResponse = await fetch(N8N_KNOWLEDGE_WEBHOOK, {
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
          entry_id: n8nPayload.data.entry_id,
          n8n_status: 'failed',
          n8n_error: `n8n responded with ${n8nResponse.status}: ${errorText}`
        },
        message: `Knowledge base ${action} completed (n8n processing failed)`,
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
        entry_id: n8nPayload.data.entry_id
      },
      message: `Knowledge base ${action} completed successfully`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Knowledge action error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
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
