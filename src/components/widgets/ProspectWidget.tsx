import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

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
}

export function ProspectWidget({ forceEmpty, className }: ProspectWidgetProps) {
  const { user } = useAuth()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [stats, setStats] = useState({ generated: 0, sent: 0, responseRate: 0 })
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [prospectMessages, setProspectMessages] = useState<Prospect[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

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

    // Fetch message generation logs with research_cache data
    const { data, error } = await supabase
      .from('message_generation_logs')
      .select(`
        id,
        message_status,
        research_cache_id,
        created_at,
        research_cache (
          id,
          profile_url,
          profile_picture_url,
          research_data
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

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

    // Get the most recent message for each prospect
    const prospects = Array.from(prospectMap.values()).map(messages => messages[0])
    setProspects(prospects)

    // Calculate stats from ALL messages (not deduplicated)
    const generated = allProspects.filter(p => ['generated', 'archived'].includes(p.message_status)).length
    const sent = allProspects.filter(p =>
      ['sent', 'approved'].includes(p.message_status)
    ).length
    // TODO: Calculate response rate when reply tracking is implemented

    console.log('📈 Stats:', { generated, sent, totalMessages: allProspects.length, uniqueProspects: prospects.length })
    setStats({ generated, sent, responseRate: 0 })
  }

  const handleSendMessage = async (messageLogId: number, messageText: string, recipientUrl: string) => {
    if (!user) return

    setIsSending(true)
    try {
      const userId = user?.id || user?.user_id

      // Call Supabase Edge Function to send message via Unipile
      const { data, error } = await supabase.functions.invoke('linkedin-send-message', {
        body: {
          user_id: userId,
          message_log_id: messageLogId,
          recipient_linkedin_url: recipientUrl,
          message_text: messageText
        }
      })

      if (error) throw error

      if (!data.success) {
        throw new Error(data.error || 'Failed to send message')
      }

      toast.success('Message sent successfully via LinkedIn!')

      // Refresh prospects to show updated status
      await fetchProspects()

      // Close modal
      setIsModalOpen(false)

    } catch (error: any) {
      console.error('❌ Error sending message:', error)
      toast.error(error.message || 'Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleProspectClick = async (prospect: Prospect) => {
    if (!prospect.research_cache_id) return

    // Fetch all messages for this prospect
    const { data, error } = await supabase
      .from('message_generation_logs')
      .select(`
        id,
        message_status,
        research_cache_id,
        created_at,
        generated_message,
        edited_message,
        message_metadata,
        ai_context,
        sent_at
      `)
      .eq('research_cache_id', prospect.research_cache_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching prospect messages:', error)
      toast.error('Failed to load prospect details')
      return
    }

    setSelectedProspect(prospect)
    setProspectMessages((data || []) as Prospect[])
    setSelectedMessageId(data?.[0]?.id || null)
    setIsModalOpen(true)
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
    // Generating states
    if (['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(status)) {
      return { dot: 'bg-[#FBAE1C]', text: 'text-[#FBAE1C]', label: 'Generating' }
    }

    switch (status) {
      case 'generated':
        return { dot: 'bg-blue-500', text: 'text-blue-400', label: 'Generated' }
      case 'approved':
        return { dot: 'bg-blue-500', text: 'text-blue-400', label: 'Sent' }
      case 'sent':
        return { dot: 'bg-purple-500', text: 'text-purple-400', label: 'Sent' }
      case 'archived':
        return { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Archived' }
      case 'failed':
        return { dot: 'bg-red-500', text: 'text-red-400', label: 'Failed' }
      default:
        return { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Unknown' }
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
            <div className="text-2xl mb-2">📊</div>
            <p className="text-xs text-gray-300">Track Opens</p>
          </div>
          <div className="rounded-xl p-3 text-center border border-white/5"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                 backdropFilter: 'blur(10px)'
               }}>
            <div className="text-2xl mb-2">💬</div>
            <p className="text-xs text-gray-300">Messages</p>
          </div>
          <div className="rounded-xl p-3 text-center border border-white/5"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                 backdropFilter: 'blur(10px)'
               }}>
            <div className="text-2xl mb-2">📈</div>
            <p className="text-xs text-gray-300">Response Rate</p>
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
            <div className="text-lg font-bold text-[#FBAE1C]">{stats.sent}</div>
            <div className="text-xs text-gray-400">Sent</div>
          </div>
          <div className="w-px bg-white/10"></div>
          <div>
            {/* TODO: Calculate response rate when reply tracking is implemented */}
            <div className="text-lg font-bold text-green-400">--</div>
            <div className="text-xs text-gray-400">Response</div>
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
                   className="rounded-xl border border-white/5 p-3 animate-pulse"
                   style={{
                     background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                   }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse"></div>
                    <div>
                      <div className="h-4 w-32 bg-gray-700 rounded mb-1"></div>
                      <div className="h-3 w-40 bg-gray-800 rounded"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center">
                      <div className="w-2 h-2 bg-[#FBAE1C] rounded-full animate-pulse"></div>
                      <div className="absolute w-2 h-2 bg-[#FBAE1C] rounded-full animate-ping"></div>
                    </div>
                    <span className="text-xs text-[#FBAE1C]">Loading...</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{getTimeSince(prospect.created_at)}</span>
                </div>
              </div>
            )
          }

          // Full prospect card with research_cache data
          const cache = prospect.research_cache
          const researchData = cache.research_data
          const profilePicture = cache.profile_picture_url ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(researchData.name)}&background=${getAvatarColor(index)}&color=fff&size=40&rounded=true`

          return (
            <button
              key={prospect.id}
              onClick={() => handleProspectClick(prospect)}
              className="w-full rounded-xl border border-white/5 p-3 transition-all text-left hover:bg-white/5 hover:border-white/10 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
              }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
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
                  <div>
                    <h3 className="text-sm font-semibold text-white">{researchData.name}</h3>
                    <p className="text-xs text-gray-400">{researchData.headline}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isGenerating ? (
                    <>
                      <div className="relative flex items-center justify-center">
                        <div className={`w-2 h-2 ${statusInfo.dot} rounded-full animate-pulse`}></div>
                        <div className={`absolute w-2 h-2 ${statusInfo.dot} rounded-full animate-ping`}></div>
                      </div>
                      <span className={`text-xs ${statusInfo.text}`}>{statusInfo.label}...</span>
                    </>
                  ) : (
                    <>
                      <div className={`w-2 h-2 ${statusInfo.dot} rounded-full`}></div>
                      <span className={`text-xs ${statusInfo.text}`}>{statusInfo.label}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{getTimeSince(prospect.created_at)}</span>
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

      {/* Prospect Details Modal - Rendered via Portal */}
      {isModalOpen && selectedProspect && selectedProspect.research_cache && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setIsModalOpen(false)}>
          <div
            className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="border-b border-white/10 p-6"
                 style={{
                   background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)'
                 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedProspect.research_cache.profile_picture_url ||
                         `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedProspect.research_cache.research_data.name)}&background=FBAE1C&color=fff&size=60&rounded=true`}
                    alt={selectedProspect.research_cache.research_data.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-[#FBAE1C]/30"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {selectedProspect.research_cache.research_data.name}
                    </h2>
                    <p className="text-sm text-gray-400">
                      {selectedProspect.research_cache.research_data.headline}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Message Count Indicator */}
              {prospectMessages.length > 1 && (
                <div className="mt-4 flex items-center gap-2">
                  <div className="bg-[#FBAE1C]/20 text-[#FBAE1C] px-3 py-1 rounded-full text-xs font-medium">
                    {prospectMessages.length} Messages Generated
                  </div>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
              {/* Message Selector - Show only if multiple messages */}
              {prospectMessages.length > 1 && (
                <div className="mb-6 flex gap-2 flex-wrap">
                  {prospectMessages.map((msg, index) => {
                    const msgStatusInfo = getStatusColor(msg.message_status)
                    const isSelected = msg.id === selectedMessageId

                    return (
                      <button
                        key={msg.id}
                        onClick={() => setSelectedMessageId(msg.id)}
                        className={`px-4 py-2 rounded-lg border transition-all text-sm ${
                          isSelected
                            ? 'border-[#FBAE1C] bg-[#FBAE1C]/20 text-[#FBAE1C]'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                        }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 ${msgStatusInfo.dot} rounded-full`}></div>
                          <span>Message {prospectMessages.length - index}</span>
                          <span className="text-xs opacity-70">{getTimeSince(msg.created_at)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Display Current Message */}
              {prospectMessages.length > 0 && (() => {
                const currentMessage = prospectMessages.find(m => m.id === selectedMessageId) || prospectMessages[0]
                const messageText = parseMessage(currentMessage.edited_message || currentMessage.generated_message)
                const messageMetadata = currentMessage.message_metadata
                  ? (typeof currentMessage.message_metadata === 'string'
                      ? JSON.parse(currentMessage.message_metadata)
                      : currentMessage.message_metadata)
                  : null

                return (
                  <div className="space-y-6">
                    {/* Generated Message */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-white/70 uppercase tracking-wide">
                          {currentMessage.edited_message ? 'Edited Message' : 'Generated Message'}
                        </h3>
                        {currentMessage.edited_message && (
                          <span className="text-xs text-[#FBAE1C]">✏️ Edited</span>
                        )}
                      </div>
                      <div className="bg-black/30 rounded-xl border border-white/10 p-4">
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {messageText || 'No message generated yet'}
                        </p>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        {messageText?.length || 0} characters
                        {messageText && messageText.length > 300 && (
                          <span className="text-red-400 ml-2">
                            ({messageText.length - 300} over LinkedIn limit)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ICP Analysis */}
                    {messageMetadata?.icp_analysis && (
                      <div>
                        <h3 className="text-sm font-medium text-white/70 uppercase tracking-wide mb-3">
                          ICP Match Analysis
                        </h3>
                        <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
                          {/* Match Score */}
                          {messageMetadata.icp_analysis.match_score && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-400">Match Score</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109]"
                                    style={{ width: `${messageMetadata.icp_analysis.match_score}%` }}
                                  />
                                </div>
                                <span className="text-[#FBAE1C] font-bold text-sm">
                                  {messageMetadata.icp_analysis.match_score}%
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Match Reasoning */}
                          {messageMetadata.icp_analysis.match_reasoning && (
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Reasoning</p>
                              <p className="text-sm text-gray-300">
                                {messageMetadata.icp_analysis.match_reasoning}
                              </p>
                            </div>
                          )}

                          {/* Key Alignment Points */}
                          {messageMetadata.icp_analysis.key_alignment_points && (
                            <div>
                              <p className="text-xs text-gray-400 mb-2">Key Alignment Points</p>
                              <ul className="space-y-1">
                                {messageMetadata.icp_analysis.key_alignment_points.map((point: string, idx: number) => (
                                  <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Potential Objections */}
                          {messageMetadata.icp_analysis.potential_objections && (
                            <div>
                              <p className="text-xs text-gray-400 mb-2">Potential Objections</p>
                              <ul className="space-y-1">
                                {messageMetadata.icp_analysis.potential_objections.map((obj: string, idx: number) => (
                                  <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                                    <span className="text-orange-500 mt-0.5">⚠</span>
                                    <span>{obj}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-white/10">
                      {(() => {
                        // Check if any message has been sent to this prospect
                        const hasBeenSent = prospectMessages.some((m: any) => m.sent_at !== null)
                        const canSend = ['generated', 'archived'].includes(currentMessage.message_status)

                        if (hasBeenSent) {
                          return (
                            <div className="flex-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 font-medium py-3 px-6 rounded-xl text-center">
                              ✓ Conversation already started
                            </div>
                          )
                        }

                        if (canSend) {
                          return (
                            <button
                              onClick={() => handleSendMessage(
                                currentMessage.id,
                                messageText,
                                selectedProspect.research_cache?.profile_url || ''
                              )}
                              disabled={isSending}
                              className="flex-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                              {isSending ? (
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  <span>Sending...</span>
                                </div>
                              ) : (
                                'Send via LinkedIn'
                              )}
                            </button>
                          )
                        }

                        return null
                      })()}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(messageText || '')
                          toast.success('Message copied to clipboard!')
                        }}
                        className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-300 transition-all">
                        Copy Message
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
    </div>
  )
}
