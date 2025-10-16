// src/pages/InboxPage.tsx
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Header } from '@/components/layout/Header'
import { Filter, Search, ThumbsUp, ThumbsDown, MessageSquare, Send, Archive, RefreshCw, X, AlertCircle } from 'lucide-react'

interface ProspectConversation {
  research_cache_id: number
  prospect_name: string
  prospect_company: string
  prospect_url: string
  conversation_thread_id: string
  latest_message: string
  latest_message_date: string
  message_status: string
  total_messages: number
  sent_count: number
  last_activity: string
}

export function InboxPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ProspectConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<ProspectConversation | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showWipBanner, setShowWipBanner] = useState(() => {
    // Check localStorage on mount
    const dismissed = localStorage.getItem('inbox_wip_banner_dismissed')
    return dismissed !== 'true'
  })

  const handleDismissBanner = () => {
    localStorage.setItem('inbox_wip_banner_dismissed', 'true')
    setShowWipBanner(false)
  }

  useEffect(() => {
    if (user) {
      fetchConversations()
    }
  }, [user, selectedFilter])

  // Auto-select first conversation when conversations load (only once)
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation && !isLoading) {
      setSelectedConversation(conversations[0])
    }
  }, [conversations, isLoading])

  // Real-time subscription for message updates
  useEffect(() => {
    if (!user) return

    const userId = user?.id

    const channel = supabase
      .channel('inbox_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_generation_logs',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Inbox update:', payload)
          // Refresh conversations when any change occurs
          fetchConversations()
        }
      )
      .subscribe((status) => {
        console.log('🔌 Inbox subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchConversations = async () => {
    if (!user) return

    setIsLoading(true)
    const userId = user?.id

    try {
      // Query to get grouped conversations by prospect - matching ProspectWidget structure
      const { data, error } = await supabase
        .from('message_generation_logs')
        .select(`
          id,
          message_status,
          research_cache_id,
          created_at,
          updated_at,
          generated_message,
          edited_message,
          message_metadata,
          ai_context,
          sent_at,
          conversation_thread_id,
          research_cache:research_cache_id (
            id,
            profile_url,
            profile_picture_url,
            research_data
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group messages by research_cache_id (prospect)
      const conversationMap = new Map<number, any>()

      data?.forEach((msg: any) => {
        const cacheId = msg.research_cache_id
        if (!cacheId) return

        const prospect = msg.research_cache?.research_data
        const prospectName = prospect?.name || 'Unknown Prospect'
        const prospectCompany = prospect?.organizations?.[0]?.name || 'Unknown Company'
        const prospectUrl = msg.research_cache?.profile_url || ''

        if (!conversationMap.has(cacheId)) {
          conversationMap.set(cacheId, {
            research_cache_id: cacheId,
            prospect_name: prospectName,
            prospect_company: prospectCompany,
            prospect_url: prospectUrl,
            conversation_thread_id: msg.conversation_thread_id,
            latest_message: msg.edited_message || msg.generated_message || '',
            latest_message_date: msg.created_at,
            message_status: msg.message_status,
            total_messages: 1,
            sent_count: msg.message_status === 'sent' ? 1 : 0,
            last_activity: msg.updated_at || msg.created_at,
            messages: [msg]
          })
        } else {
          const existing = conversationMap.get(cacheId)
          existing.total_messages++
          if (msg.message_status === 'sent') existing.sent_count++
          if (new Date(msg.created_at) > new Date(existing.latest_message_date)) {
            existing.latest_message = msg.edited_message || msg.generated_message || ''
            existing.latest_message_date = msg.created_at
            existing.message_status = msg.message_status
          }
          existing.messages.push(msg)
        }
      })

      let filteredConversations = Array.from(conversationMap.values())

      // Apply status filter
      if (selectedFilter !== 'all') {
        filteredConversations = filteredConversations.filter(conv => {
          switch (selectedFilter) {
            case 'sent':
              return conv.sent_count > 0
            case 'generated':
              return conv.message_status === 'generated'
            case 'archived':
              return conv.message_status === 'archived'
            default:
              return true
          }
        })
      }

      // Apply search filter
      if (searchQuery) {
        filteredConversations = filteredConversations.filter(conv =>
          conv.prospect_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          conv.prospect_company.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }

      setConversations(filteredConversations)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'generated': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'archived': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    }
  }

  const getAvatarColor = (index: number) => {
    const colors = ['FBAE1C', 'FC9109', 'DD6800', 'FBAE1C']
    return colors[index % colors.length]
  }

  const filters = [
    { id: 'all', label: 'All Messages', count: conversations.length },
    { id: 'sent', label: 'Sent', count: conversations.filter(c => c.sent_count > 0).length },
    { id: 'generated', label: 'Generated', count: conversations.filter(c => c.message_status === 'generated').length },
    { id: 'archived', label: 'Archived', count: conversations.filter(c => c.message_status === 'archived').length }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1b] via-[#1a1f36] to-[#0a0e1b] text-white">
      {/* Use shared Header component */}
      <Header />

      {/* Work in Progress Banner */}
      {showWipBanner && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-yellow-400 text-sm font-medium">
                  Work in Progress
                </p>
                <p className="text-yellow-300/80 text-xs">
                  This inbox is currently under development. Some features may not work as expected, and data may not be fully accurate.
                </p>
              </div>
              <button
                onClick={handleDismissBanner}
                className="p-1 rounded-lg hover:bg-yellow-500/20 text-yellow-400 transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="max-w-7xl mx-auto mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent">
                Message Inbox
              </h1>
              <p className="text-gray-400 text-sm">Track and manage your outreach conversations</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showSearch
                    ? 'bg-[#FBAE1C]/20 text-[#FBAE1C] border border-[#FBAE1C]/30'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                <Search className="w-4 h-4" />
                {showSearch ? 'Hide Search' : 'Search'}
              </button>
              <button
                onClick={fetchConversations}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FBAE1C]/10 hover:bg-[#FBAE1C]/20 text-[#FBAE1C] transition-colors border border-[#FBAE1C]/30"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

        {/* Collapsible Search Bar */}
        {showSearch && (
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search prospects by name or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-2 focus:ring-[#FBAE1C]/10 transition-all"
              autoFocus
            />
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-white/10 mb-4">
          <div className="flex gap-1 overflow-x-auto">
            {filters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`flex items-center gap-2 px-4 py-2 whitespace-nowrap transition-all border-b-2 ${
                  selectedFilter === filter.id
                    ? 'border-[#FBAE1C] text-[#FBAE1C]'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {filter.label}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedFilter === filter.id
                    ? 'bg-[#FBAE1C]/20 text-[#FBAE1C]'
                    : 'bg-white/10 text-gray-500'
                }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - Split Pane Layout */}
      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-300px)]">
            <div className="w-8 h-8 border-3 border-[#FBAE1C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] text-center">
            <MessageSquare className="w-16 h-16 text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No conversations yet</h3>
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'No prospects match your search' : 'Generate your first message to see it here'}
            </p>
          </div>
        ) : (
          /* Split Pane: List + Detail */
          <div className="flex gap-4 h-[calc(100vh-300px)]">
            {/* Left Side - Conversation List */}
            <div className="w-[400px] flex-shrink-0 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conversation, index) => {
                  const profilePicture = conversation.messages?.[0]?.research_cache?.profile_picture_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.prospect_name)}&background=${getAvatarColor(index)}&color=fff&size=40&rounded=true`

                  return (
                    <div
                      key={conversation.research_cache_id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`p-4 border-b border-white/10 cursor-pointer transition-all ${
                        selectedConversation?.research_cache_id === conversation.research_cache_id
                          ? 'bg-[#FBAE1C]/10 border-l-4 border-l-[#FBAE1C]'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Header: Avatar + Name + Status */}
                      <div className="flex items-start gap-3 mb-2">
                        <img
                          src={profilePicture}
                          alt={conversation.prospect_name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.prospect_name)}&background=${getAvatarColor(index)}&color=fff&size=40&rounded=true`
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-white truncate">
                                {conversation.prospect_name}
                              </h3>
                              <p className="text-xs text-gray-400 truncate">{conversation.prospect_company}</p>
                            </div>
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs border flex-shrink-0 ${getStatusColor(conversation.message_status)}`}>
                              {conversation.message_status}
                            </span>
                          </div>
                        </div>
                      </div>

                    {/* Message Preview */}
                    <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                      {conversation.latest_message}
                    </p>

                    {/* Footer: Date + Count */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {new Date(conversation.latest_message_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      <span>
                        {conversation.total_messages} message{conversation.total_messages !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>

            {/* Right Side - Conversation Detail */}
            <div className="flex-1 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Header */}
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-4">
                        <img
                          src={selectedConversation.messages?.[0]?.research_cache?.profile_picture_url ||
                               `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConversation.prospect_name)}&background=FBAE1C&color=fff&size=60&rounded=true`}
                          alt={selectedConversation.prospect_name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-[#FBAE1C]/30"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConversation.prospect_name)}&background=FBAE1C&color=fff&size=60&rounded=true`
                          }}
                        />
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-1">
                            {selectedConversation.prospect_name}
                          </h2>
                          <p className="text-gray-400">{selectedConversation.prospect_company}</p>
                          <a
                            href={selectedConversation.prospect_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#FBAE1C] hover:underline"
                          >
                            View LinkedIn Profile
                          </a>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // TODO: Generate new message
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FBAE1C]/10 hover:bg-[#FBAE1C]/20 text-[#FBAE1C] transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Generate New
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Archive
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Message Thread */}
                  <div className="flex-1 overflow-y-auto p-6 bg-[#0a0e1b]">
                    <div className="max-w-4xl mx-auto space-y-6">
                      {selectedConversation.messages?.sort((a: any, b: any) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                      ).map((msg: any, idx: number) => {
                        const isSent = msg.message_status === 'sent'
                        return (
                          <div key={msg.id} className="group">
                            {/* Date divider if new day */}
                            {(idx === 0 || new Date(msg.created_at).toDateString() !== new Date(selectedConversation.messages[idx - 1].created_at).toDateString()) && (
                              <div className="flex items-center gap-3 mb-4">
                                <div className="h-px flex-1 bg-white/10" />
                                <span className="text-xs text-gray-500">
                                  {new Date(msg.created_at).toLocaleDateString('en-GB', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                                <div className="h-px flex-1 bg-white/10" />
                              </div>
                            )}

                            {/* Message bubble - All our messages on the right */}
                            <div className="flex justify-end">
                              <div className="max-w-[85%] items-end flex flex-col">
                                {/* Status and time */}
                                <div className="flex items-center gap-2 mb-1 px-1">
                                  <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(msg.message_status)}`}>
                                    {msg.message_status}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(msg.created_at).toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>

                                {/* Message content */}
                                <div className={`relative rounded-2xl p-4 ${
                                  isSent
                                    ? 'bg-[#FBAE1C]/20 border border-[#FBAE1C]/30'
                                    : 'bg-white/5 border border-white/10'
                                }`}>
                                  <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                                    {msg.edited_message || msg.generated_message}
                                  </p>

                                  {/* Hover actions - always on left since messages are on right */}
                                  <div className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                    <button
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-green-500/20 text-gray-400 hover:text-green-400 transition-colors"
                                      title="Good message"
                                    >
                                      <ThumbsUp className="w-4 h-4" />
                                    </button>
                                    <button
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                                      title="Poor message"
                                    >
                                      <ThumbsDown className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Read/Delivered indicators for sent messages */}
                                {isSent && msg.sent_at && (
                                  <div className="flex items-center gap-1 mt-1 px-1 text-xs text-gray-500">
                                    <Send className="w-3 h-3" />
                                    <span>Sent</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Message Input Area */}
                  <div className="p-4 border-t border-white/10 bg-[#0a0e1b]">
                    <div className="max-w-4xl mx-auto">
                      <div className="flex items-end gap-3">
                        <div className="flex-1 bg-white/5 rounded-xl border border-white/10 focus-within:border-[#FBAE1C]/30 transition-colors">
                          <textarea
                            placeholder="Type a message or generate a new one..."
                            rows={3}
                            className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none"
                          />
                          <div className="flex items-center justify-between px-4 py-2 border-t border-white/10">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  // TODO: Generate new message
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-[#FBAE1C]/10 hover:bg-[#FBAE1C]/20 text-[#FBAE1C] transition-colors flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Generate with AI
                              </button>
                            </div>
                            <button
                              className="px-4 py-1.5 rounded-lg bg-[#FBAE1C] hover:bg-[#FC9109] text-black font-medium transition-colors flex items-center gap-2"
                            >
                              <Send className="w-4 h-4" />
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Empty state */
                <div className="flex-1 flex items-center justify-center text-center p-6">
                  <div>
                    <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-400 mb-2">
                      Select a conversation
                    </h3>
                    <p className="text-sm text-gray-500">
                      Choose a prospect from the list to view their message history
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
