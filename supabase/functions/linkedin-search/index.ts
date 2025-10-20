// supabase/functions/linkedin-search/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LinkedInSearchRequest {
  user_id: string
  search_query: string
  filters?: {
    location?: string
    current_company?: string
    industry?: string
    title?: string
  }
  page?: number
  limit?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Parse request payload
    const payload: LinkedInSearchRequest = await req.json()
    console.log('🔍 LinkedIn search request:', payload)

    // Validate required fields
    if (!payload.user_id || !payload.search_query) {
      throw new Error('Missing required fields: user_id and search_query')
    }

    // Get user's LinkedIn account
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('unipile_account_id, linkedin_connected')
      .eq('user_id', payload.user_id)
      .eq('linkedin_connected', true)
      .single()

    if (profileError || !profile || !profile.unipile_account_id) {
      console.error('❌ No LinkedIn account found:', profileError)
      throw new Error('LinkedIn account not connected. Please connect your LinkedIn account first.')
    }

    console.log('✅ Found LinkedIn account:', profile.unipile_account_id)

    // Get Unipile API configuration
    const unipileApiUrl = Deno.env.get('UNIPILE_API_URL')
    const unipileApiKey = Deno.env.get('UNIPILE_API_KEY')

    if (!unipileApiUrl || !unipileApiKey) {
      throw new Error('Unipile API not configured')
    }

    // Build search URL with query parameters
    const searchUrl = new URL(`${unipileApiUrl}/api/v1/users/${profile.unipile_account_id}/search`)
    searchUrl.searchParams.append('query', payload.search_query)
    searchUrl.searchParams.append('provider', 'LINKEDIN')

    if (payload.page) {
      searchUrl.searchParams.append('page', payload.page.toString())
    }

    if (payload.limit) {
      searchUrl.searchParams.append('limit', Math.min(payload.limit, 100).toString()) // Max 100 per request
    }

    // Add filters if provided
    if (payload.filters) {
      if (payload.filters.location) {
        searchUrl.searchParams.append('location', payload.filters.location)
      }
      if (payload.filters.current_company) {
        searchUrl.searchParams.append('current_company', payload.filters.current_company)
      }
      if (payload.filters.industry) {
        searchUrl.searchParams.append('industry', payload.filters.industry)
      }
      if (payload.filters.title) {
        searchUrl.searchParams.append('title', payload.filters.title)
      }
    }

    console.log('🔍 Calling Unipile search:', searchUrl.toString())

    // Call Unipile search API
    const searchResponse = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'X-API-KEY': unipileApiKey,
        'accept': 'application/json'
      }
    })

    if (!searchResponse.ok) {
      const errorData = await searchResponse.text()
      console.error('❌ Unipile search error:', errorData)
      throw new Error(`Unipile search failed: ${searchResponse.status}`)
    }

    const searchData = await searchResponse.json()
    console.log(`✅ Found ${searchData.items?.length || 0} results`)

    // Transform results to a cleaner format
    const prospects = searchData.items?.map((item: any) => ({
      linkedin_url: item.profile_url || `https://www.linkedin.com/in/${item.public_identifier}`,
      public_identifier: item.public_identifier,
      messaging_id: item.provider_id,
      name: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      first_name: item.first_name,
      last_name: item.last_name,
      headline: item.occupation || item.headline,
      company: item.organizations?.[0]?.name,
      location: item.location,
      profile_picture_url: item.profile_picture_url,
      raw_data: item
    })) || []

    // Return search results
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          prospects,
          total: searchData.total || prospects.length,
          page: payload.page || 1,
          has_more: searchData.has_more || false
        },
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ LinkedIn search error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})

/* To test locally:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/linkedin-search' \
    --header 'Authorization: Bearer [YOUR_USER_TOKEN]' \
    --header 'Content-Type: application/json' \
    --data '{
      "user_id": "test-user-123",
      "search_query": "software engineer",
      "filters": {
        "location": "San Francisco",
        "title": "Senior Engineer"
      },
      "page": 1,
      "limit": 25
    }'

*/
