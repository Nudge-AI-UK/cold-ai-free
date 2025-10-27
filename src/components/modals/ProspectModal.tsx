import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ExternalLink, User, Briefcase, MapPin, Users as UsersIcon, TrendingUp, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

  // Fetch prospect data when prospectId changes
  useEffect(() => {
    if (prospectId) {
      fetchProspectData()
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
          focus_report_markdown
        `)
        .eq('research_cache_id', prospectData.research_cache_id)
        .order('created_at', { ascending: false })

      if (messagesError) throw messagesError

      setProspectMessages((messages || []) as ProspectMessage[])
      setSelectedMessageId(messages?.[0]?.id || null)

    } catch (error) {
      console.error('❌ Error fetching prospect data:', error)
      toast.error('Failed to load prospect data')
    } finally {
      setIsLoading(false)
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
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className="text-white">Loading prospect data...</span>
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

        {/* Progress Dots at bottom */}
        {allProspectIds.length > 1 && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
            {allProspectIds.map((id, index) => {
              const isActive = index === currentIndex

              return (
                <div
                  key={id}
                  className={`
                    transition-all duration-300 cursor-pointer
                    ${isActive ? 'scale-125' : 'scale-100 hover:scale-110'}
                  `}
                  onClick={(e) => {
                    e.stopPropagation()
                    // Navigate directly to this prospect
                    const targetId = allProspectIds[index]
                    if (targetId !== prospectId) {
                      // We don't have a direct navigate function, so we'll use next/prev
                      // This is a limitation - ideally we'd pass a navigateToIndex prop
                    }
                  }}
                >
                  <div
                    className={`
                      w-2 h-2 rounded-full transition-all duration-300
                      ${isActive
                        ? 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] shadow-lg shadow-[#FBAE1C]/30 w-8'
                        : 'bg-white/30 hover:bg-white/50'
                      }
                    `}
                  />
                </div>
              )
            })}
          </div>
        )}

        <div className="w-full max-w-6xl h-[calc(100vh-2rem)] max-h-[90vh]">
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
                  {prospectMessages.length > 1 && (
                    <div className="mt-2 bg-[#FBAE1C]/20 text-[#FBAE1C] px-2 py-1 rounded-full text-xs font-medium inline-block">
                      {prospectMessages.length} Messages Generated
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex gap-6 h-full">
            {/* Left Column - Focus Report */}
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white/70 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="text-lg">📊</span>
                Focus Analysis Report
              </h4>
              <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10 max-h-[calc(90vh-280px)] overflow-y-auto">
                {(() => {
                  const currentMessage = prospectMessages.find(m => m.id === selectedMessageId) || prospectMessages[0]
                  let focusMarkdown = currentMessage?.focus_report_markdown

                  if (focusMarkdown) {
                    // Preprocess markdown to add double line breaks after lines starting with **Label:**
                    focusMarkdown = focusMarkdown.replace(/(\*\*[^*]+\*\*[^\n]+)\n(?!\n)/g, '$1\n\n')

                    return (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mb-3 mt-5 first:mt-0" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-white mb-2 mt-4" {...props} />,
                            p: ({node, ...props}) => <p className="text-gray-300 leading-relaxed mb-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="text-gray-300" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                            em: ({node, ...props}) => <em className="italic text-gray-400" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#FBAE1C] pl-4 italic text-gray-400 my-4" {...props} />,
                            code: ({node, ...props}) => <code className="bg-black/40 px-1.5 py-0.5 rounded text-[#FBAE1C] text-sm" {...props} />,
                            hr: ({node, ...props}) => <hr className="border-white/10 my-6" {...props} />,
                            a: ({node, ...props}) => <a className="text-[#FBAE1C] hover:text-[#FC9109] underline transition-colors" {...props} />,
                          }}
                        >
                          {focusMarkdown}
                        </ReactMarkdown>
                      </div>
                    )
                  }

                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <span className="text-4xl mb-3 opacity-30">📄</span>
                      <p className="text-sm">No focus report available</p>
                      <p className="text-xs text-gray-600 mt-1">Report will appear here when generated</p>
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

                {/* Message Selector - Show only if multiple messages */}
                {prospectMessages.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
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
                        <div className="mt-2 text-xs text-gray-500">
                          {displayMessage?.length || 0} characters
                          {displayMessage && displayMessage.length > 300 && (
                            <span className="text-red-400 ml-2">
                              ({displayMessage.length - 300} over LinkedIn limit)
                            </span>
                          )}
                        </div>
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
