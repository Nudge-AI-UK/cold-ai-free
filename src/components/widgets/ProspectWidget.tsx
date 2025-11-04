import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useProspectModal } from '@/components/modals/ProspectModalManager'

// Helper function to parse and clean message
const parseMessage = (message: string): string => {
  if (!message) return ''

  // Try to parse if it's a JSON string
  try {
    const parsed = JSON.parse(message)
    if (typeof parsed === 'string') {
      message = parsed
    }
  } catch {
    // Not JSON, use as-is
  }

  // Replace escaped newlines with actual newlines
  return message.replace(/\\n/g, '\n')
}

interface ProspectWidgetProps {
  forceEmpty?: boolean
  className?: string
}

interface ResearchData {
  name: string
  headline: string
  location: string
  follower_count?: number
  public_identifier?: string
}

interface ResearchCache {
  id: number
  profile_url: string
  profile_picture_url?: string
  research_data: ResearchData
}

interface Prospect {
  id: number
  message_status: string
  research_cache_id: number | null
  research_cache: ResearchCache | null
  created_at: string
  sent_at?: string | null
  generated_message?: string
  edited_message?: string
  message_metadata?: any
  ai_context?: any
  focus_report_markdown?: string
  message_count?: number
  all_statuses?: string[]
}

export function ProspectWidget({ forceEmpty, className }: ProspectWidgetProps) {
  const { user } = useAuth()
  const { openProspectModal } = useProspectModal()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [stats, setStats] = useState({ generated: 0, scheduled: 0, sent: 0 })

  useEffect(() => {
    if (user && !forceEmpty) {
      fetchProspects()
    }
  }, [user, forceEmpty])

  // Real-time subscription for prospect updates
  useEffect(() => {
    if (!user) return

    const userId = user?.id || user?.user_id

    const channel = supabase
      .channel('prospect_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_generation_logs',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Prospect update:', payload)
          // Refresh prospects list when any change occurs
          fetchProspects()
        }
      )
      .subscribe((status) => {
        console.log('🔌 Prospect subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchProspects = async () => {
    if (!user) return

    const userId = user?.id || user?.user_id

    // Fetch ALL message generation logs with research_cache data (no limit)
    // We need all messages to properly filter by status history
    const { data, error } = await supabase
      .from('message_generation_logs')
      .select(`
        id,
        message_status,
        research_cache_id,
        created_at,
        research_cache!inner (
          id,
          profile_url,
          profile_picture_url,
          research_data,
          deleted_at
        )
      `)
      .eq('user_id', userId)
      .is('research_cache.deleted_at', null)
      .in('message_status', ['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message', 'generated', 'pending_scheduled', 'scheduled', 'sent', 'reply_received', 'reply_sent', 'archived', 'failed'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching prospects:', error)
      return
    }

    console.log('📊 Fetched prospects:', data)
    const allProspects = (data || []) as Prospect[]

    // Group by research_cache_id and keep only the most recent for each prospect
    const prospectMap = new Map<number, Prospect[]>()
    allProspects.forEach(p => {
      if (!p.research_cache_id) return
      if (!prospectMap.has(p.research_cache_id)) {
        prospectMap.set(p.research_cache_id, [])
      }
      prospectMap.get(p.research_cache_id)!.push(p)
    })

    // Get the most recent message for each prospect and add message count
    // Filter to show only prospects needing immediate action
    const prospects = Array.from(prospectMap.values())
      .map(messages => {
        const mostRecent = messages[0]
        return {
          ...mostRecent,
          message_count: messages.length,
          all_statuses: messages.map(m => m.message_status)
        }
      })
      .filter(prospect => {
        const statuses = prospect.all_statuses

        // Hide if scheduled or pending_scheduled (already in pipeline)
        if (statuses.includes('scheduled') || statuses.includes('pending_scheduled')) {
          return false
        }

        // Hide if sent (conversation already started)
        if (statuses.includes('sent')) {
          return false
        }

        // Show generating states
        const generatingStatuses = ['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message']
        if (generatingStatuses.includes(prospect.message_status)) {
          return true
        }

        // Show generated messages (ready to schedule)
        if (prospect.message_status === 'generated') {
          return true
        }

        // Show reply_received (needs response)
        if (prospect.message_status === 'reply_received') {
          return true
        }

        // Show failed messages (need attention)
        if (prospect.message_status === 'failed') {
          return true
        }

        // Show archived ONLY if never been contacted or scheduled
        if (prospect.message_status === 'archived') {
          const hasBeenContactedOrScheduled = statuses.some(s =>
            ['sent', 'scheduled', 'pending_scheduled'].includes(s)
          )
          return !hasBeenContactedOrScheduled
        }

        return false
      })
      .slice(0, 10) // Limit to 10 prospects for display

    setProspects(prospects)

    // Fetch ALL messages for stats (not limited to 10)
    const { data: allMessages } = await supabase
      .from('message_generation_logs')
      .select('message_status')
      .eq('user_id', userId)

    const allMessagesList = (allMessages || []) as { message_status: string }[]

    // Calculate stats from ALL user messages
    const generated = allMessagesList.length // Every message ever made
    const scheduled = allMessagesList.filter(m =>
      ['pending_scheduled', 'scheduled'].includes(m.message_status)
    ).length
    const sent = allMessagesList.filter(m =>
      ['sent', 'reply_received', 'reply_sent'].includes(m.message_status)
    ).length

    console.log('📈 Stats:', { generated, scheduled, sent, totalMessages: allMessagesList.length, uniqueProspects: prospects.length })
    setStats({ generated, scheduled, sent })
  }

  const handleProspectClick = (prospect: Prospect) => {
    if (!prospect.id) return

    // Get all prospect IDs to enable navigation
    const prospectIds = prospects.map(p => p.id)

    // Open the modal with the prospect ID and all IDs for navigation
    openProspectModal(prospect.id, prospectIds)
  }

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`
    }
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }

  const getStatusColor = (status: string) => {
    // Generating states - purple
    if (['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(status)) {
      return { dot: 'bg-purple-500', text: 'text-purple-400', label: 'Generating' }
    }

    switch (status) {
      case 'generated':
        return { dot: 'bg-blue-500', text: 'text-blue-400', label: 'Generated' }
      case 'pending_scheduled':
        return { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Pending' }
      case 'scheduled':
        return { dot: 'bg-orange-500', text: 'text-orange-400', label: 'Scheduled' }
      case 'sent':
        return { dot: 'bg-green-500', text: 'text-green-400', label: 'Sent' }
      case 'reply_received':
        return { dot: 'bg-yellow-500', text: 'text-yellow-400', label: 'Reply Received' }
      case 'reply_sent':
        return { dot: 'bg-green-500', text: 'text-green-400', label: 'Reply Sent' }
      case 'archived':
        return { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Archived' }
      case 'failed':
        return { dot: 'bg-red-500', text: 'text-red-400', label: 'Failed' }
      default:
        return { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Unknown' }
    }
  }

  const getCardBorderStyle = (status: string) => {
    // Generating states - purple with glow
    if (['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(status)) {
      return 'border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
    }

    switch (status) {
      case 'generated':
        return 'border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
      case 'pending_scheduled':
        return 'border-2 border-gray-500'
      case 'scheduled':
        return 'border-2 border-orange-500'
      case 'sent':
        return 'border-2 border-green-500'
      case 'reply_received':
        return 'border-2 border-yellow-500'
      case 'reply_sent':
        return 'border-2 border-green-500'
      case 'archived':
        return 'border-2 border-gray-500 opacity-70'
      case 'failed':
        return 'border-2 border-red-500'
      default:
        return 'border-2 border-gray-500'
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('')
  }

  const getAvatarColor = (index: number) => {
    const colors = ['FBAE1C', 'FC9109', 'DD6800', 'FBAE1C']
    return colors[index % colors.length]
  }


  // Empty State
  if (forceEmpty || prospects.length === 0) {
    return (
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Account Info */}
        <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
          Free Account: 25 Messages/Month
        </div>

        {/* Central Icon and Message */}
        <div className="text-center py-8">
          <div className="relative inline-block mb-6" style={{ animation: 'float 3s ease-in-out infinite' }}>
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
              <span className="text-5xl">👥</span>
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
              0
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2"
              style={{
                background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'shimmer 3s linear infinite'
              }}>
            No Prospects Yet
          </h2>
          
          <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
            Start generating personalised messages to build your prospect pipeline
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl p-3 text-center border border-white/5"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                 backdropFilter: 'blur(10px)'
               }}>
            <div className="text-2xl mb-2">✨</div>
            <p className="text-xs text-gray-300">Generated</p>
          </div>
          <div className="rounded-xl p-3 text-center border border-white/5"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                 backdropFilter: 'blur(10px)'
               }}>
            <div className="text-2xl mb-2">📅</div>
            <p className="text-xs text-gray-300">Scheduled</p>
          </div>
          <div className="rounded-xl p-3 text-center border border-white/5"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                 backdropFilter: 'blur(10px)'
               }}>
            <div className="text-2xl mb-2">✅</div>
            <p className="text-xs text-gray-300">Sent</p>
          </div>
        </div>

        {/* What You'll See Section */}
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/5">
          <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">What You'll Track</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FBAE1C]"></div>
              <span className="text-xs text-gray-300">Prospect profiles & company details</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FC9109]"></div>
              <span className="text-xs text-gray-300">Message status & engagement</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#DD6800]"></div>
              <span className="text-xs text-gray-300">Response rates & follow-ups</span>
            </div>
          </div>
        </div>

        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Active State with Prospects
  return (
    <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white flex flex-col ${className}`}
         style={{
           background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
           backdropFilter: 'blur(10px)',
           WebkitBackdropFilter: 'blur(10px)'
         }}>

      {/* Header Section */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-3xl">👥</div>
          <div>
            <h2 className="text-xl font-bold"
                style={{
                  background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'shimmer 3s linear infinite'
                }}>
              Prospects
            </h2>
            <p className="text-xs text-gray-400">{prospects.length} active conversations</p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 mb-6 border border-white/5 flex-shrink-0">
        <div className="flex justify-around text-center">
          <div>
            <div className="text-lg font-bold">{stats.generated}</div>
            <div className="text-xs text-gray-400">Generated</div>
          </div>
          <div className="w-px bg-white/10"></div>
          <div>
            <div className="text-lg font-bold text-[#FBAE1C]">{stats.scheduled}</div>
            <div className="text-xs text-gray-400">Scheduled</div>
          </div>
          <div className="w-px bg-white/10"></div>
          <div>
            <div className="text-lg font-bold text-green-400">{stats.sent}</div>
            <div className="text-xs text-gray-400">Sent</div>
          </div>
        </div>
      </div>

      {/* Prospects List - Extends to bottom */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {prospects.map((prospect, index) => {
          // Debug: console.log('🔍 Prospect data:', prospect)
          const isGenerating = ['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(prospect.message_status)
          const statusInfo = getStatusColor(prospect.message_status)

          // Placeholder card if no research_cache yet
          if (!prospect.research_cache) {
            console.log('⚠️ No research_cache for prospect:', prospect.id)
            return (
              <div key={prospect.id}
                   className={`rounded-xl p-3 animate-pulse ${getCardBorderStyle(prospect.message_status)}`}
                   style={{
                     background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                   }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-32 bg-gray-700 rounded mb-1"></div>
                    <div className="h-3 w-40 bg-gray-800 rounded"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{getTimeSince(prospect.created_at)}</span>
                    <span className="text-gray-500">|</span>
                    <div className="relative flex items-center justify-center">
                      <div className="w-2 h-2 bg-[#FBAE1C] rounded-full animate-pulse"></div>
                      <div className="absolute w-2 h-2 bg-[#FBAE1C] rounded-full animate-ping"></div>
                    </div>
                    <span className="text-xs text-[#FBAE1C]">Loading...</span>
                  </div>
                </div>
              </div>
            )
          }

          // Full prospect card with research_cache data
          const cache = prospect.research_cache
          // Parse research_data if it's a string
          let researchData = cache.research_data
          if (typeof researchData === 'string') {
            try {
              researchData = JSON.parse(researchData)
            } catch (e) {
              console.error('Failed to parse research_data:', e)
              researchData = { name: 'Unknown', headline: 'Unknown' }
            }
          }
          const profilePicture = cache.profile_picture_url ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(researchData.name)}&background=${getAvatarColor(index)}&color=fff&size=40&rounded=true`

          return (
            <button
              key={prospect.id}
              onClick={() => handleProspectClick(prospect)}
              className={`relative w-full rounded-xl p-3 transition-all text-left hover:bg-white/5 cursor-pointer ${getCardBorderStyle(prospect.message_status)}`}
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
              }}>
              {/* Message Count Badge - Top Right */}
              {prospect.message_count && prospect.message_count > 1 && (
                <div className="absolute top-1 right-1 w-6 h-6 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg z-10">
                  {prospect.message_count}
                </div>
              )}

              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <img
                    src={profilePicture}
                    alt={researchData.name}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      // Fallback to UI avatars if LinkedIn image fails
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(researchData.name)}&background=${getAvatarColor(index)}&color=fff&size=40&rounded=true`
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">{researchData.name}</h3>
                  <p className="text-xs text-gray-400 line-clamp-1">{researchData.headline || researchData.occupation || 'No title'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{getTimeSince(prospect.created_at)}</span>
                  {isGenerating ? (
                    <>
                      <span className="text-gray-500">|</span>
                      <div className="relative flex items-center justify-center">
                        <div className={`w-2 h-2 ${statusInfo.dot} rounded-full animate-pulse`}></div>
                        <div className={`absolute w-2 h-2 ${statusInfo.dot} rounded-full animate-ping`}></div>
                      </div>
                      <span className={`text-xs ${statusInfo.text}`}>{statusInfo.label}...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-500">|</span>
                      <div className={`w-2 h-2 ${statusInfo.dot} rounded-full`}></div>
                      <span className={`text-xs ${statusInfo.text}`}>{statusInfo.label}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <div
                    onClick={() => cache.profile_url && window.open(cache.profile_url, '_blank')}
                    className="text-[#FBAE1C] text-xs hover:text-white transition-colors flex items-center gap-1 cursor-pointer">
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
    </div>
  )
}
