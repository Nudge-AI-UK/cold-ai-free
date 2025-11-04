import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ExternalLink, User, Briefcase, MapPin, Users as UsersIcon, TrendingUp, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { AnimatedModalBackground } from './AnimatedModalBackground'

interface ProspectModalProps {
  prospectId: number
  allProspectIds: number[]
  onClose: () => void
  onNavigateNext: () => void
  onNavigatePrevious: () => void
}

interface ResearchData {
  name: string
  headline?: string
  location?: string
  company?: string
  follower_count?: number
  occupation?: string
}

interface ResearchCache {
  id: number
  profile_url: string
  profile_picture_url?: string
  research_data: ResearchData
}

interface ProspectMessage {
  id: number
  message_status: string
  research_cache_id: number | null
  created_at: string
  sent_at?: string | null
  generated_message?: string
  edited_message?: string
  message_metadata?: any
  ai_context?: any
  focus_report_markdown?: string
  message_type?: string
}

// Helper function to parse and clean message
const parseMessage = (message: string): string => {
  if (!message) return ''

  try {
    const parsed = JSON.parse(message)
    if (typeof parsed === 'string') {
      message = parsed
    }
  } catch {
    // Not JSON, use as-is
  }

  return message.replace(/\\n/g, '\n')
}

// Helper to parse research data
const parseResearchData = (data: any): ResearchData => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch (e) {
      console.error('Failed to parse research_data:', e)
      return { name: 'Unknown', headline: 'Unknown' }
    }
  }
  return data
}

// Helper to get status color
const getStatusColor = (status: string) => {
  if (['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(status)) {
    return { dot: 'bg-[#FBAE1C]', text: 'text-[#FBAE1C]', border: 'border-[#FBAE1C]', label: 'Generating' }
  }

  switch (status) {
    case 'generated':
      return { dot: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500', label: 'Generated' }
    case 'approved':
      return { dot: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500', label: 'Sent' }
    case 'pending_scheduled':
      return { dot: 'bg-gray-500', text: 'text-gray-400', border: 'border-gray-500', label: 'Pending' }
    case 'scheduled':
      return { dot: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500', label: 'Scheduled' }
    case 'sent':
      return { dot: 'bg-green-500', text: 'text-green-400', border: 'border-green-500', label: 'Sent' }
    case 'reply_received':
      return { dot: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500', label: 'Reply Received' }
    case 'reply_sent':
      return { dot: 'bg-green-500', text: 'text-green-400', border: 'border-green-500', label: 'Reply Sent' }
    case 'archived':
      return { dot: 'bg-gray-500', text: 'text-gray-400', border: 'border-gray-500', label: 'Archived' }
    case 'failed':
      return { dot: 'bg-red-500', text: 'text-red-400', border: 'border-red-500', label: 'Failed' }
    default:
      return { dot: 'bg-gray-500', text: 'text-gray-400', border: 'border-gray-500', label: 'Unknown' }
  }
}

// Helper to get time since
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

// Helper function to get character limits and message type info
const getMessageLimits = (messageType: string | null) => {
  if (!messageType) {
    return {
      limit: 600,
      target: 600,
      max: 1900,
      type: 'unknown',
      description: 'Default limit'
    }
  }

  if (messageType === 'connection_request_200') {
    return {
      limit: 200,
      target: 200,
      max: 200,
      type: 'connection_request',
      description: 'Connection Request (Free Account)'
    }
  }

  if (messageType === 'connection_request_300') {
    return {
      limit: 300,
      target: 300,
      max: 300,
      type: 'connection_request',
      description: 'Connection Request (Premium Account)'
    }
  }

  if (messageType === 'inmail' || messageType === 'open_profile') {
    return {
      limit: 600,
      target: 800,
      max: 1900,
      recommendedMax: 850,
      type: 'inmail',
      description: messageType === 'inmail' ? 'InMail Message' : 'Open Profile Message'
    }
  }

  if (messageType === 'direct_message' || messageType === 'first_message') {
    return {
      limit: 600,
      target: 800,
      max: 8000,
      recommendedMax: 850,
      type: 'direct_message',
      description: 'Direct Message'
    }
  }

  // Default to direct message limits for unknown types
  return {
    limit: 600,
    target: 800,
    max: 8000,
    recommendedMax: 850,
    type: 'unknown',
    description: 'Message'
  }
}

interface AdjacentProspect {
  id: number
  name: string
  avatar: string
}

export function ProspectModal({
  prospectId,
  allProspectIds,
  onClose,
  onNavigateNext,
  onNavigatePrevious
}: ProspectModalProps) {
  const { user } = useAuth()
  const [researchCache, setResearchCache] = useState<ResearchCache | null>(null)
  const [prospectMessages, setProspectMessages] = useState<ProspectMessage[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [editedMessage, setEditedMessage] = useState<string>('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [prevProspect, setPrevProspect] = useState<AdjacentProspect | null>(null)
  const [nextProspect, setNextProspect] = useState<AdjacentProspect | null>(null)

  // Fetch prospect data when prospectId changes
  useEffect(() => {
    if (prospectId) {
      fetchProspectData()
      fetchAdjacentProspects()
    }
  }, [prospectId])

  // Reset edited message when selected message changes
  useEffect(() => {
    setEditedMessage('')
  }, [selectedMessageId])

  // Auto-save edited message (debounced) - only for generated messages
  useEffect(() => {
    if (!selectedMessageId || !editedMessage) return

    const currentMessage = prospectMessages.find(m => m.id === selectedMessageId)
    if (!currentMessage || currentMessage.message_status !== 'generated') return

    console.log('💾 Auto-saving edited message...', { selectedMessageId, editedLength: editedMessage?.length || 0 })
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('message_generation_logs')
        .update({ edited_message: editedMessage })
        .eq('id', selectedMessageId)
        .select()

      if (error) {
        console.error('❌ Failed to save edited message:', error)
      } else {
        console.log('✅ Edited message saved:', data)
      }
    }, 1000) // Save 1s after user stops typing

    return () => clearTimeout(timer)
  }, [editedMessage, selectedMessageId, prospectMessages])

  const fetchProspectData = async () => {
    setIsLoading(true)
    try {
      if (!user) return

      const userId = user?.id || user?.user_id

      // First, get the prospect to find research_cache_id
      const { data: prospectData, error: prospectError } = await supabase
        .from('message_generation_logs')
        .select(`
          id,
          research_cache_id,
          research_cache (
            id,
            profile_url,
            profile_picture_url,
            research_data
          )
        `)
        .eq('id', prospectId)
        .single()

      if (prospectError) throw prospectError

      if (!prospectData?.research_cache) {
        toast.error('Prospect research data not found')
        onClose()
        return
      }

      setResearchCache(prospectData.research_cache as ResearchCache)

      // Now fetch all messages for this prospect
      const { data: messages, error: messagesError } = await supabase
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
          sent_at,
          focus_analysis,
          message_type
        `)
        .eq('research_cache_id', prospectData.research_cache_id)
        .order('created_at', { ascending: false })

      if (messagesError) throw messagesError

      // Apply filtering logic: prioritize active messages over archived
      const allMessages = (messages || []) as ProspectMessage[]
      const activeStatuses = ['pending_scheduled', 'scheduled', 'sent', 'reply_received', 'reply_sent']
      const hasActiveMessage = allMessages.some(m => activeStatuses.includes(m.message_status))

      const filteredMessages = hasActiveMessage
        ? allMessages.filter(m => m.message_status !== 'archived')
        : allMessages

      setProspectMessages(filteredMessages)
      setSelectedMessageId(filteredMessages[0]?.id || null)

    } catch (error) {
      console.error('❌ Error fetching prospect data:', error)
      toast.error('Failed to load prospect data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAdjacentProspects = async () => {
    try {
      const currentIndex = allProspectIds.indexOf(prospectId)
      const prevProspectId = currentIndex > 0 ? allProspectIds[currentIndex - 1] : null
      const nextProspectId = currentIndex < allProspectIds.length - 1 ? allProspectIds[currentIndex + 1] : null

      // Fetch previous prospect data
      if (prevProspectId) {
        const { data: prevData, error: prevError } = await supabase
          .from('message_generation_logs')
          .select(`
            id,
            research_cache (
              profile_picture_url,
              research_data
            )
          `)
          .eq('id', prevProspectId)
          .single()

        if (!prevError && prevData?.research_cache) {
          const prevResearchData = parseResearchData(prevData.research_cache.research_data)
          setPrevProspect({
            id: prevProspectId,
            name: prevResearchData.name || 'Unknown',
            avatar: prevData.research_cache.profile_picture_url ||
                   `https://ui-avatars.com/api/?name=${encodeURIComponent(prevResearchData.name || 'Unknown')}&background=FBAE1C&color=fff&size=60&rounded=true`
          })
        }
      } else {
        setPrevProspect(null)
      }

      // Fetch next prospect data
      if (nextProspectId) {
        const { data: nextData, error: nextError } = await supabase
          .from('message_generation_logs')
          .select(`
            id,
            research_cache (
              profile_picture_url,
              research_data
            )
          `)
          .eq('id', nextProspectId)
          .single()

        if (!nextError && nextData?.research_cache) {
          const nextResearchData = parseResearchData(nextData.research_cache.research_data)
          setNextProspect({
            id: nextProspectId,
            name: nextResearchData.name || 'Unknown',
            avatar: nextData.research_cache.profile_picture_url ||
                   `https://ui-avatars.com/api/?name=${encodeURIComponent(nextResearchData.name || 'Unknown')}&background=FBAE1C&color=fff&size=60&rounded=true`
          })
        }
      } else {
        setNextProspect(null)
      }
    } catch (error) {
      console.error('❌ Error fetching adjacent prospects:', error)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with form inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (canGoPrevious) {
            e.preventDefault()
            onNavigatePrevious()
          }
          break
        case 'ArrowRight':
          if (canGoNext) {
            e.preventDefault()
            onNavigateNext()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNavigateNext, onNavigatePrevious, onClose, prospectId, allProspectIds])

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

      // Refresh prospect data
      await fetchProspectData()

    } catch (error: any) {
      console.error('❌ Error sending message:', error)
      toast.error(error.message || 'Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const researchData = researchCache ? parseResearchData(researchCache.research_data) : null
  const currentIndex = allProspectIds.indexOf(prospectId)
  const canGoNext = currentIndex < allProspectIds.length - 1
  const canGoPrevious = currentIndex > 0

  if (!researchCache || isLoading) {
    return createPortal(
      <>
        <AnimatedModalBackground />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,14,27,0.4)] backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[rgba(10,14,27,0.95)] to-[rgba(26,31,54,0.95)] border border-white/10 rounded-2xl p-8">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <img
                  src="/Square_bishop.svg"
                  alt="Loading"
                  className="w-12 h-12 animate-pulse"
                />
                <div className="absolute inset-0 rounded-full border-2 border-[#FBAE1C]/30 border-t-[#FBAE1C] animate-spin"></div>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body
    )
  }

  return createPortal(
    <>
      <AnimatedModalBackground />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,14,27,0.4)] backdrop-blur-sm"
        onClick={onClose}>

        {/* Navigation Arrows - Positioned at edges of screen */}
        {allProspectIds.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNavigatePrevious()
              }}
              disabled={!canGoPrevious}
              className={`
                absolute top-1/2 left-4 transform -translate-y-1/2 z-20
                w-12 h-12 rounded-full bg-transparent border-none
                flex items-center justify-center cursor-pointer transition-all duration-300
                ${canGoPrevious
                  ? 'opacity-100 hover:scale-110'
                  : 'opacity-30 cursor-not-allowed'
                }
              `}
            >
              <ChevronLeft
                className={`
                  w-8 h-8 transition-all duration-300
                  ${canGoPrevious
                    ? 'text-white/90 hover:text-[#FBAE1C] drop-shadow-lg'
                    : 'text-white/30'
                  }
                `}
                strokeWidth={2.5}
              />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onNavigateNext()
              }}
              disabled={!canGoNext}
              className={`
                absolute top-1/2 right-4 transform -translate-y-1/2 z-20
                w-12 h-12 rounded-full bg-transparent border-none
                flex items-center justify-center cursor-pointer transition-all duration-300
                ${canGoNext
                  ? 'opacity-100 hover:scale-110'
                  : 'opacity-30 cursor-not-allowed'
                }
              `}
            >
              <ChevronRight
                className={`
                  w-8 h-8 transition-all duration-300
                  ${canGoNext
                    ? 'text-white/90 hover:text-[#FBAE1C] drop-shadow-lg'
                    : 'text-white/30'
                  }
                `}
                strokeWidth={2.5}
              />
            </button>
          </>
        )}

        {/* Bottom Navigation with Circular Profile Buttons */}
        {allProspectIds.length > 1 && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-4">
            {/* Previous Prospect Button */}
            {prevProspect ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onNavigatePrevious()
                }}
                disabled={!canGoPrevious}
                className={`
                  w-14 h-14 rounded-full p-0.5 transition-all duration-300
                  ${canGoPrevious
                    ? 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] hover:scale-110 cursor-pointer shadow-lg shadow-[#FBAE1C]/30'
                    : 'bg-white/20 cursor-not-allowed opacity-50'
                  }
                `}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-black/20">
                  <img
                    src={prevProspect.avatar}
                    alt={prevProspect.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </button>
            ) : (
              <div className="w-14 h-14" />
            )}

            {/* Current Position Indicator */}
            <div className="text-xs text-white/70 font-medium bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
              {currentIndex + 1} / {allProspectIds.length}
            </div>

            {/* Next Prospect Button */}
            {nextProspect ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onNavigateNext()
                }}
                disabled={!canGoNext}
                className={`
                  w-14 h-14 rounded-full p-0.5 transition-all duration-300
                  ${canGoNext
                    ? 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] hover:scale-110 cursor-pointer shadow-lg shadow-[#FBAE1C]/30'
                    : 'bg-white/20 cursor-not-allowed opacity-50'
                  }
                `}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-black/20">
                  <img
                    src={nextProspect.avatar}
                    alt={nextProspect.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </button>
            ) : (
              <div className="w-14 h-14" />
            )}
          </div>
        )}

        <div className="w-full max-w-[95vw] h-[calc(100vh-2rem)] max-h-[95vh]">
          <div className="w-full h-full flex flex-col rounded-3xl border border-white/10 text-white overflow-hidden bg-gradient-to-br from-[rgba(10,14,27,0.95)] to-[rgba(26,31,54,0.95)] backdrop-blur-[10px] shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex-shrink-0 p-6 pb-4 border-b border-white/10 bg-gradient-to-b from-[rgba(10,14,27,0.98)] to-[rgba(26,31,54,0.95)] relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 z-10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4 pr-12">
                <img
                  src={researchCache.profile_picture_url ||
                       `https://ui-avatars.com/api/?name=${encodeURIComponent(researchData?.name || 'Unknown')}&background=FBAE1C&color=fff&size=60&rounded=true`}
                  alt={researchData?.name || 'Prospect'}
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#FBAE1C]/30"
                />
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    {researchData?.name || 'Unknown'}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {researchData?.headline || researchData?.occupation || 'No title'}
                  </p>
                  {(() => {
                    const totalMessagesCount = prospectMessages.length
                    if (totalMessagesCount > 1) {
                      return (
                        <div className="mt-2 bg-[#FBAE1C]/20 text-[#FBAE1C] px-2 py-1 rounded-full text-xs font-medium inline-block">
                          {totalMessagesCount} Messages Generated
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex gap-6 pb-20">
            {/* Left Column - Focus Analysis */}
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white/70 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="text-lg">📊</span>
                Focus Analysis
              </h4>
              <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10 max-h-[calc(90vh-280px)] overflow-y-auto">
                {(() => {
                  const currentMessage = prospectMessages.find(m => m.id === selectedMessageId) || prospectMessages[0]
                  const focusAnalysis = currentMessage?.focus_analysis

                  if (focusAnalysis) {
                    return (
                      <div className="space-y-6">
                        {/* Recommended Approach */}
                        {focusAnalysis.recommended_focus && (
                          <div>
                            <h3 className="text-base font-bold text-white mb-3">Recommended Approach</h3>
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Primary Angle</p>
                                <p className="text-[#FBAE1C] font-medium">{focusAnalysis.recommended_focus.primary_angle}</p>
                              </div>

                              {focusAnalysis.recommended_focus.why_this_works && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Why This Works</p>
                                  <p className="text-gray-300 leading-relaxed">{focusAnalysis.recommended_focus.why_this_works}</p>
                                </div>
                              )}

                              {focusAnalysis.recommended_focus.evidence_quote && (
                                <div className="bg-black/30 border-l-4 border-[#FBAE1C] pl-4 py-2 italic text-gray-400 text-xs">
                                  "{focusAnalysis.recommended_focus.evidence_quote}"
                                </div>
                              )}

                              {focusAnalysis.recommended_focus.connection_to_product && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Product Connection</p>
                                  <p className="text-gray-300 leading-relaxed">{focusAnalysis.recommended_focus.connection_to_product}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-white/10"></div>

                        {/* Prospect Insights */}
                        {focusAnalysis.prospect_insights && (
                          <div>
                            <h3 className="text-base font-bold text-white mb-3">Prospect Insights</h3>
                            <div className="space-y-3 text-sm">
                              {focusAnalysis.prospect_insights.recent_activity_summary && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Recent Activity</p>
                                  <p className="text-gray-300 leading-relaxed">{focusAnalysis.prospect_insights.recent_activity_summary}</p>
                                </div>
                              )}

                              {focusAnalysis.prospect_insights.most_relevant_pain_points && focusAnalysis.prospect_insights.most_relevant_pain_points.length > 0 && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Key Pain Points</p>
                                  <ul className="space-y-2">
                                    {focusAnalysis.prospect_insights.most_relevant_pain_points.map((point: string, idx: number) => (
                                      <li key={idx} className="text-gray-300 flex items-start gap-2">
                                        <span className="text-[#FBAE1C] mt-1">•</span>
                                        <span>{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {focusAnalysis.prospect_insights.icp_alignment_score !== undefined && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">ICP Alignment</p>
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109]"
                                        style={{ width: `${focusAnalysis.prospect_insights.icp_alignment_score}%` }}
                                      />
                                    </div>
                                    <span className="text-[#FBAE1C] font-bold text-sm">
                                      {focusAnalysis.prospect_insights.icp_alignment_score}/100
                                    </span>
                                  </div>
                                  {focusAnalysis.prospect_insights.icp_reasoning && (
                                    <p className="text-gray-400 text-xs italic">{focusAnalysis.prospect_insights.icp_reasoning}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-white/10"></div>

                        {/* Messaging Strategy */}
                        {focusAnalysis.messaging_strategy && (
                          <div>
                            <h3 className="text-base font-bold text-white mb-3">Messaging Strategy</h3>
                            <div className="space-y-3 text-sm">
                              {focusAnalysis.messaging_strategy.recommended_tone && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Recommended Tone</p>
                                  <p className="text-[#FBAE1C] font-medium">{focusAnalysis.messaging_strategy.recommended_tone}</p>
                                  {focusAnalysis.messaging_strategy.tone_reasoning && (
                                    <p className="text-gray-400 text-xs mt-1 italic">{focusAnalysis.messaging_strategy.tone_reasoning}</p>
                                  )}
                                </div>
                              )}

                              {focusAnalysis.messaging_strategy.angles_to_avoid && focusAnalysis.messaging_strategy.angles_to_avoid.length > 0 && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Angles to Avoid</p>
                                  <ul className="space-y-1">
                                    {focusAnalysis.messaging_strategy.angles_to_avoid.map((angle: string, idx: number) => (
                                      <li key={idx} className="text-red-400 text-xs flex items-start gap-2">
                                        <span>❌</span>
                                        <span>{angle}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {focusAnalysis.messaging_strategy.differentiation_strategy && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Differentiation Strategy</p>
                                  <p className="text-gray-300 leading-relaxed">{focusAnalysis.messaging_strategy.differentiation_strategy}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-white/10"></div>

                        {/* Product Alignment */}
                        {focusAnalysis.product_alignment && (
                          <div>
                            <h3 className="text-base font-bold text-white mb-3">Product Alignment</h3>
                            <div className="space-y-3 text-sm">
                              {focusAnalysis.product_alignment.relevant_capabilities && focusAnalysis.product_alignment.relevant_capabilities.length > 0 && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Relevant Capabilities</p>
                                  <ul className="space-y-2">
                                    {focusAnalysis.product_alignment.relevant_capabilities.map((cap: string, idx: number) => (
                                      <li key={idx} className="text-gray-300 flex items-start gap-2">
                                        <span className="text-green-500 mt-1">✓</span>
                                        <span>{cap}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {focusAnalysis.product_alignment.value_proposition_approach && (
                                <div>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Value Proposition</p>
                                  <p className="text-gray-300 leading-relaxed">{focusAnalysis.product_alignment.value_proposition_approach}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <span className="text-4xl mb-3 opacity-30">📄</span>
                      <p className="text-sm">No focus analysis available</p>
                      <p className="text-xs text-gray-600 mt-1">Analysis will appear here when generated</p>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Right Column - Messages & ICP Analysis */}
            <div className="flex-1">
              <div className="space-y-6">
                {/* Prospect Info Card */}
                <div>
                  <h4 className="text-sm font-medium text-white/70 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#FBAE1C]" />
                    Prospect Details
                  </h4>
                  <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      {researchData.company && (
                        <div className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          <span>{researchData.company}</span>
                        </div>
                      )}
                      {researchData.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{researchData.location}</span>
                        </div>
                      )}
                      {researchData.follower_count && (
                        <div className="flex items-center gap-1">
                          <UsersIcon className="w-3 h-3" />
                          <span>{researchData.follower_count.toLocaleString()} followers</span>
                        </div>
                      )}
                    </div>
                    {researchCache.profile_url && (
                      <button
                        onClick={() => window.open(researchCache.profile_url, '_blank')}
                        className="mt-3 flex items-center gap-2 text-[#FBAE1C] hover:text-[#FC9109] transition-colors text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>View LinkedIn Profile</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Message Selector - Show filtered messages with status-colored borders */}
                {(() => {
                  if (prospectMessages.length <= 1) return null

                  return (
                    <div className="flex gap-2 flex-wrap">
                      {prospectMessages.map((msg, index) => {
                        const msgStatusInfo = getStatusColor(msg.message_status)
                        const isSelected = msg.id === selectedMessageId
                        const isArchived = msg.message_status === 'archived'

                        return (
                          <button
                            key={msg.id}
                            onClick={() => setSelectedMessageId(msg.id)}
                            className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                              isSelected
                                ? `${msgStatusInfo.border} ${msgStatusInfo.text} bg-${msgStatusInfo.dot.replace('bg-', '')}/20`
                                : isArchived
                                ? 'border-gray-500/30 bg-white/5 text-gray-500 hover:border-gray-500/50 opacity-60'
                                : `${msgStatusInfo.border}/30 bg-white/5 text-gray-400 hover:${msgStatusInfo.border}/50`
                            }`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 ${msgStatusInfo.dot} rounded-full`}></div>
                              <span>Message {prospectMessages.length - index}</span>
                              <span className="text-xs opacity-70">{getTimeSince(msg.created_at)}</span>
                              {isArchived && <span className="text-xs opacity-50">(Archived)</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Display Current Message */}
                {prospectMessages.length > 0 && (() => {
                  const currentMessage = prospectMessages.find(m => m.id === selectedMessageId) || prospectMessages[0]
                  const generatedMessage = parseMessage(currentMessage.generated_message)
                  const savedEditedMessage = parseMessage(currentMessage.edited_message)

                  // Use local editedMessage state if set, otherwise fall back to saved edited_message, then generated_message
                  const displayMessage = editedMessage || savedEditedMessage || generatedMessage
                  const hasEdits = editedMessage || savedEditedMessage

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
                            {hasEdits ? 'Edited Message' : 'Generated Message'}
                          </h3>
                          {hasEdits && (
                            <span className="text-xs text-[#FBAE1C]">✏️ Edited</span>
                          )}
                        </div>
                        {/* Editable only for "generated" status */}
                        {currentMessage.message_status === 'generated' ? (
                          <textarea
                            value={displayMessage || ''}
                            onChange={(e) => setEditedMessage(e.target.value)}
                            className="w-full min-h-[200px] bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#FBAE1C]/50 transition-all duration-200 resize-none"
                            placeholder="No message generated yet"
                          />
                        ) : (
                          <div className="w-full min-h-[200px] bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                              {displayMessage || 'No message generated yet'}
                            </p>
                          </div>
                        )}
                        {(() => {
                          const messageLength = displayMessage?.length || 0
                          const limits = getMessageLimits(currentMessage.message_type || null)
                          const isOverLimit = messageLength > limits.max
                          const isOverRecommended = limits.recommendedMax && messageLength > limits.recommendedMax

                          return (
                            <>
                              <div className="mt-2 text-xs">
                                <div className="flex flex-col gap-1">
                                  <span className={isOverLimit ? 'text-red-400 font-medium' : isOverRecommended ? 'text-orange-400 font-medium' : 'text-gray-500'}>
                                    Character count: {messageLength}/{limits.max}
                                    {isOverLimit && ` (${messageLength - limits.max} over limit)`}
                                  </span>
                                  {messageLength < limits.limit && (
                                    <span className="text-gray-500 text-[10px]">
                                      Target: {limits.limit}-{limits.target} chars for optimal engagement
                                    </span>
                                  )}
                                  {messageLength >= limits.limit && messageLength <= limits.target && (
                                    <span className="text-green-400 text-[10px]">
                                      ✓ Within target range ({limits.limit}-{limits.target})
                                    </span>
                                  )}
                                  {currentMessage.message_type && (
                                    <span className="text-gray-600 text-[10px]">
                                      {limits.description}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isOverLimit && limits.type === 'connection_request' && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-400 mt-2">
                                  ⚠️ LinkedIn connection requests are limited to {limits.max} characters. This message will be rejected.
                                </div>
                              )}

                              {isOverLimit && limits.type === 'inmail' && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-400 mt-2">
                                  ⚠️ InMail messages have a hard limit of {limits.max} characters. This message will be truncated.
                                </div>
                              )}

                              {isOverRecommended && !isOverLimit && (limits.type === 'inmail' || limits.type === 'direct_message' || limits.type === 'unknown') && (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 text-xs text-orange-400 mt-2">
                                  💡 Cold AI recommends shorter, focused messages that start conversations for better response rates. Keep it under {limits.recommendedMax} characters.
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>

                      {/* ICP Analysis */}
                      {messageMetadata?.icp_analysis && (
                        <div>
                          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-[#FBAE1C]" />
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
                                  displayMessage,
                                  researchCache.profile_url || ''
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
                            navigator.clipboard.writeText(displayMessage || '')
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
          </div>
        </div>
      </div>
    </div>
      </div>
    </>,
    document.body
  )
}
