// src/pages/ProspectsPage.tsx
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Header } from '@/components/layout/Header'
import { toast } from 'sonner'
import { Users, ExternalLink, Calendar, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, SlidersHorizontal, X, MoreVertical, Trash2 } from 'lucide-react'
import { useProspectModal } from '@/components/modals/ProspectModalManager'

type SortColumn = 'name' | 'jobTitle' | 'status' | 'messages' | 'added' | 'scheduled'
type SortDirection = 'asc' | 'desc'
type StatusFilter = 'all' | 'analysing_prospect' | 'researching_product' | 'analysing_icp' | 'generating_message' | 'generated' | 'pending_scheduled' | 'scheduled' | 'sent' | 'reply_received' | 'reply_sent' | 'archived' | 'failed'

const PROSPECTS_PER_PAGE = 50

interface ProspectRules {
  // Time-based rules
  activityDays: number | null // null = no filter, or number of days
  addedDays: number | null
  hideInactiveDays: number | null

  // Message status rules
  hideAllArchived: boolean
  onlyAwaitingReply: boolean
  onlyReplied: boolean
  hideReplied: boolean

  // Message count thresholds
  minMessages: number | null
  maxMessages: number | null
  hideFailedThreshold: number | null // Hide if X+ failed messages

  // Action required
  onlyGenerated: boolean
  onlyPendingScheduled: boolean
  onlyFailed: boolean

  // Quick presets
  hotLeads: boolean
  activeOutreach: boolean
  readyToSchedule: boolean
  coldLeads: boolean
  cleanView: boolean
}

interface ResearchData {
  name: string
  headline?: string
  company?: string
  location?: string
  follower_count?: number
  public_identifier?: string
}

interface ResearchCache {
  id: number
  profile_url: string
  profile_picture_url?: string
  research_data: ResearchData | string
}

interface MessageLog {
  id: number
  message_status: string
  research_cache_id: number | null
  research_cache: ResearchCache | null
  created_at: string
  updated_at: string
  sequence_prospects?: Array<{ scheduled_for: string }>
}

interface ProspectRow {
  researchCacheId: number
  id: number // Most recent message_generation_log id
  name: string
  avatar: string
  linkedinUrl: string
  jobTitle: string
  company: string
  messageStatus: string
  createdAt: Date
  updatedAt: Date // When the message status last changed
  scheduledFor?: Date
  messageCount: number
  allStatuses: string[] // All status history for this prospect
}

const getStatusBadge = (status: string) => {
  // Generating states - purple
  if (['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(status)) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-purple-500/20 text-purple-400 border-purple-500/30">
        Generating
      </span>
    )
  }

  const badges: Record<string, { label: string; color: string }> = {
    'generated': { label: 'Generated', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    'pending_scheduled': { label: 'Pending', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    'scheduled': { label: 'Scheduled', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    'sending': { label: 'Sending', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    'sent': { label: 'Sent', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    'reply_received': { label: 'Reply Received', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    'reply_sent': { label: 'Reply Sent', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    'archived': { label: 'Archived', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    'failed': { label: 'Failed', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  }

  const badge = badges[status] || { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}>
      {badge.label}
    </span>
  )
}

const getAvatarColor = (index: number) => {
  const colors = ['FBAE1C', 'FC9109', 'DD6800', 'FBAE1C']
  return colors[index % colors.length]
}

// Helper to get message count badge color based on status
const getMessageCountBadgeColor = (status: string) => {
  // Generating states - purple
  if (['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(status)) {
    return 'bg-purple-500'
  }

  const colors: Record<string, string> = {
    'generated': 'bg-blue-500',
    'pending_scheduled': 'bg-gray-500',
    'scheduled': 'bg-orange-500',
    'sending': 'bg-orange-500',
    'sent': 'bg-green-500',
    'reply_received': 'bg-yellow-500',
    'reply_sent': 'bg-green-500',
    'archived': 'bg-gray-500',
    'failed': 'bg-red-500',
  }

  return colors[status] || 'bg-gray-500'
}

const DEFAULT_RULES: ProspectRules = {
  activityDays: null,
  addedDays: null,
  hideInactiveDays: null,
  hideAllArchived: false,
  onlyAwaitingReply: false,
  onlyReplied: false,
  hideReplied: false,
  minMessages: null,
  maxMessages: null,
  hideFailedThreshold: null,
  onlyGenerated: false,
  onlyPendingScheduled: false,
  onlyFailed: false,
  hotLeads: false,
  activeOutreach: false,
  readyToSchedule: false,
  coldLeads: false,
  cleanView: false,
}

export function ProspectsPage() {
  const { user } = useAuth()
  const { openProspectModal } = useProspectModal()
  const [prospects, setProspects] = useState<ProspectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('added')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [activeFilters, setActiveFilters] = useState<StatusFilter[]>(['all'])
  const [currentPage, setCurrentPage] = useState(1)
  const [rules, setRules] = useState<ProspectRules>(() => {
    const saved = localStorage.getItem('prospectRules')
    return saved ? JSON.parse(saved) : DEFAULT_RULES
  })
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [openMenuProspectId, setOpenMenuProspectId] = useState<number | null>(null)
  const [deleteConfirmProspect, setDeleteConfirmProspect] = useState<{ id: number; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchProspects = async () => {
    if (!user) return

    try {
        const userId = user.id || user.user_id
        console.log('Fetching prospects for user:', userId)

        // Fetch message generation logs with research_cache data - matching ProspectWidget approach
        const { data, error } = await supabase
          .from('message_generation_logs')
          .select(`
            id,
            message_status,
            research_cache_id,
            created_at,
            updated_at,
            research_cache!inner (
              id,
              profile_url,
              profile_picture_url,
              research_data,
              deleted_at
            ),
            sequence_prospects!sequence_prospects_message_log_id_fkey (
              scheduled_for
            )
          `)
          .eq('user_id', userId)
          .is('research_cache.deleted_at', null)
          .in('message_status', [
            'analysing_prospect',
            'researching_product',
            'analysing_icp',
            'generating_message',
            'generated',
            'pending_scheduled',
            'scheduled',
            'sent',
            'reply_received',
            'reply_sent',
            'archived',
            'failed'
          ])
          .order('created_at', { ascending: false })

        console.log('Fetched message generation logs:', data)
        console.log('Error (if any):', error)

        if (error) throw error

        const allMessages = (data || []) as MessageLog[]

        // Group by research_cache_id and keep only the most recent for each prospect
        const prospectMap = new Map<number, MessageLog[]>()
        allMessages.forEach(msg => {
          if (!msg.research_cache_id) return
          if (!prospectMap.has(msg.research_cache_id)) {
            prospectMap.set(msg.research_cache_id, [])
          }
          prospectMap.get(msg.research_cache_id)!.push(msg)
        })

        // Get the most recent message for each prospect and add message count
        // Apply filtering logic: prioritize active messages over archived
        const mappedProspects: ProspectRow[] = Array.from(prospectMap.entries())
          .map(([cacheId, messages], index) => {
            // Filter out archived messages if there are active messages for this prospect
            const activeStatuses = ['pending_scheduled', 'scheduled', 'sent', 'reply_received', 'reply_sent']
            const hasActiveMessage = messages.some(m => activeStatuses.includes(m.message_status))

            const filteredMessages = hasActiveMessage
              ? messages.filter(m => m.message_status !== 'archived')
              : messages

            // Get the most recent message after filtering
            const mostRecent = filteredMessages[0]

            if (!mostRecent?.research_cache) return null

            const cache = mostRecent.research_cache

            // Parse research_data if it's a string
            let researchData: ResearchData = typeof cache.research_data === 'string'
              ? JSON.parse(cache.research_data)
              : cache.research_data

            const scheduledFor = mostRecent.sequence_prospects?.[0]?.scheduled_for

            return {
              researchCacheId: cacheId,
              id: mostRecent.id,
              name: researchData.name || 'Unknown',
              avatar: cache.profile_picture_url || researchData.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(researchData.name || 'U')}&background=${getAvatarColor(index)}&color=fff&size=128`,
              linkedinUrl: cache.profile_url || '',
              jobTitle: researchData.headline || 'No job title',
              company: researchData.company || 'No company',
              messageStatus: mostRecent.message_status,
              createdAt: new Date(mostRecent.created_at),
              updatedAt: new Date(mostRecent.updated_at),
              scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
              messageCount: filteredMessages.length, // Use filtered count, not all messages
              allStatuses: messages.map(m => m.message_status) // All status history (before filtering)
            }
          })
          .filter((p): p is ProspectRow => p !== null)

      console.log('Mapped prospects:', mappedProspects)
      console.log('Total unique prospects:', mappedProspects.length)
      setProspects(mappedProspects)
    } catch (error) {
      console.error('Error fetching prospects:', error)
      toast.error('Failed to load prospects')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchProspects()
    }
  }, [user])

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

  // Get status counts for filter chips
  const getStatusCounts = () => {
    return {
      all: prospects.length,
      analysing_prospect: prospects.filter(p => p.messageStatus === 'analysing_prospect').length,
      researching_product: prospects.filter(p => p.messageStatus === 'researching_product').length,
      analysing_icp: prospects.filter(p => p.messageStatus === 'analysing_icp').length,
      generating_message: prospects.filter(p => p.messageStatus === 'generating_message').length,
      generated: prospects.filter(p => p.messageStatus === 'generated').length,
      pending_scheduled: prospects.filter(p => p.messageStatus === 'pending_scheduled').length,
      scheduled: prospects.filter(p => p.messageStatus === 'scheduled').length,
      sent: prospects.filter(p => p.messageStatus === 'sent').length,
      reply_received: prospects.filter(p => p.messageStatus === 'reply_received').length,
      reply_sent: prospects.filter(p => p.messageStatus === 'reply_sent').length,
      archived: prospects.filter(p => p.messageStatus === 'archived').length,
      failed: prospects.filter(p => p.messageStatus === 'failed').length,
    }
  }

  const statusCounts = getStatusCounts()

  // Handle filter toggle
  const handleFilterToggle = (filter: StatusFilter) => {
    setCurrentPage(1) // Reset to first page when filter changes
    if (filter === 'all') {
      setActiveFilters(['all'])
    } else {
      if (activeFilters.includes(filter)) {
        const newFilters = activeFilters.filter(f => f !== filter && f !== 'all')
        setActiveFilters(newFilters.length === 0 ? ['all'] : newFilters)
      } else {
        const newFilters = activeFilters.filter(f => f !== 'all')
        setActiveFilters([...newFilters, filter])
      }
    }
  }

  // Handle sort column change
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column with default descending for most columns, ascending for name
      setSortColumn(column)
      setSortDirection(column === 'name' ? 'asc' : 'desc')
    }
  }

  // Apply rules filtering
  const applyRules = (prospect: ProspectRow): boolean => {
    const now = new Date()

    // Quick presets (these override other rules)
    if (rules.hotLeads) {
      const has14DayReply = ['reply_received', 'reply_sent'].includes(prospect.messageStatus)
      const recentActivity = prospect.createdAt.getTime() > now.getTime() - (14 * 24 * 60 * 60 * 1000)
      return has14DayReply && recentActivity
    }

    if (rules.activeOutreach) {
      const isActive = ['scheduled', 'sent'].includes(prospect.messageStatus)
      const notReplied = !['reply_received', 'reply_sent'].includes(prospect.messageStatus)
      return isActive && notReplied
    }

    if (rules.readyToSchedule) {
      // Show generated messages
      if (prospect.messageStatus === 'generated') return true

      // Show archived messages for prospects who have never been scheduled or contacted
      if (prospect.messageStatus === 'archived') {
        const hasBeenContactedOrScheduled = prospect.allStatuses.some(s =>
          ['scheduled', 'pending_scheduled', 'sent', 'reply_received', 'reply_sent'].includes(s)
        )
        return !hasBeenContactedOrScheduled
      }

      return false
    }

    if (rules.coldLeads) {
      // For sent messages, check when it was sent (updatedAt), not when prospect was added
      const is14DaysOld = prospect.updatedAt.getTime() < now.getTime() - (14 * 24 * 60 * 60 * 1000)
      const isSent = prospect.messageStatus === 'sent'
      const noReply = !['reply_received', 'reply_sent'].includes(prospect.messageStatus)
      return is14DaysOld && isSent && noReply
    }

    if (rules.cleanView) {
      return !['archived', 'failed'].includes(prospect.messageStatus)
    }

    // Time-based rules
    if (rules.activityDays !== null) {
      const daysAgo = now.getTime() - (rules.activityDays * 24 * 60 * 60 * 1000)
      if (prospect.createdAt.getTime() < daysAgo) return false
    }

    if (rules.addedDays !== null) {
      const daysAgo = now.getTime() - (rules.addedDays * 24 * 60 * 60 * 1000)
      if (prospect.createdAt.getTime() < daysAgo) return false
    }

    if (rules.hideInactiveDays !== null) {
      const daysAgo = now.getTime() - (rules.hideInactiveDays * 24 * 60 * 60 * 1000)
      if (prospect.createdAt.getTime() < daysAgo) return false
    }

    // Message status rules
    if (rules.hideAllArchived && prospect.messageStatus === 'archived') return false

    if (rules.onlyAwaitingReply) {
      const isSent = prospect.messageStatus === 'sent'
      const noReply = !['reply_received', 'reply_sent'].includes(prospect.messageStatus)
      if (!(isSent && noReply)) return false
    }

    if (rules.onlyReplied) {
      if (!['reply_received', 'reply_sent'].includes(prospect.messageStatus)) return false
    }

    if (rules.hideReplied) {
      if (['reply_received', 'reply_sent'].includes(prospect.messageStatus)) return false
    }

    // Message count thresholds
    if (rules.minMessages !== null && prospect.messageCount < rules.minMessages) return false
    if (rules.maxMessages !== null && prospect.messageCount > rules.maxMessages) return false

    // Action required rules
    if (rules.onlyGenerated && prospect.messageStatus !== 'generated') return false
    if (rules.onlyPendingScheduled && prospect.messageStatus !== 'pending_scheduled') return false
    if (rules.onlyFailed && prospect.messageStatus !== 'failed') return false

    return true
  }

  // Filter and sort prospects
  const filteredAndSortedProspects = prospects
    .filter(p => {
      // Search filter
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())

      // Status filter
      const matchesStatus = activeFilters.includes('all') || activeFilters.length === 0 ||
                           activeFilters.includes(p.messageStatus as StatusFilter)

      // Rules filter
      const matchesRules = applyRules(p)

      return matchesSearch && matchesStatus && matchesRules
    })
    .sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'jobTitle':
          comparison = a.jobTitle.localeCompare(b.jobTitle)
          break
        case 'status':
          comparison = a.messageStatus.localeCompare(b.messageStatus)
          break
        case 'messages':
          comparison = a.messageCount - b.messageCount
          break
        case 'added':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break
        case 'scheduled':
          // Handle null values - put them at the end
          if (!a.scheduledFor && !b.scheduledFor) comparison = 0
          else if (!a.scheduledFor) comparison = 1
          else if (!b.scheduledFor) comparison = -1
          else comparison = a.scheduledFor.getTime() - b.scheduledFor.getTime()
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProspects.length / PROSPECTS_PER_PAGE)
  const paginatedProspects = filteredAndSortedProspects.slice(
    (currentPage - 1) * PROSPECTS_PER_PAGE,
    currentPage * PROSPECTS_PER_PAGE
  )

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  // Save rules to localStorage when they change
  useEffect(() => {
    localStorage.setItem('prospectRules', JSON.stringify(rules))
  }, [rules])

  // Handle prospect click to open modal
  const handleProspectClick = (prospectId: number) => {
    // Get all prospect IDs for navigation (use all filtered/sorted, not just current page)
    const prospectIds = filteredAndSortedProspects.map(p => p.id)
    // Open the modal with the prospect ID and all IDs for navigation
    openProspectModal(prospectId, prospectIds)
  }

  // Handle prospect removal (soft delete)
  const handleRemoveProspect = async (researchCacheId: number) => {
    if (!user) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('research_cache')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', researchCacheId)

      if (error) throw error

      toast.success('Prospect removed successfully')
      setDeleteConfirmProspect(null)
      // Refresh the prospects list
      fetchProspects()
    } catch (error) {
      console.error('Error removing prospect:', error)
      toast.error('Failed to remove prospect')
    } finally {
      setIsDeleting(false)
    }
  }

  // Count active rules
  const activeRulesCount = Object.entries(rules).filter(([key, value]) => {
    if (key === 'activityDays' || key === 'addedDays' || key === 'hideInactiveDays' ||
        key === 'minMessages' || key === 'maxMessages' || key === 'hideFailedThreshold') {
      return value !== null
    }
    return value === true
  }).length

  // Render sortable column header
  const renderSortableHeader = (label: string, column: SortColumn) => {
    const isActive = sortColumn === column
    return (
      <th
        onClick={() => handleSort(column)}
        className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-[#FBAE1C] transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-[#FBAE1C]" />
            ) : (
              <ArrowDown className="h-3 w-3 text-[#FBAE1C]" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />
          )}
        </div>
      </th>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1b] via-[#1a1f36] to-[#0a0e1b] text-white">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
              <img
                src="/Square_bishop.svg"
                alt="Cold AI"
                className="w-16 h-16 animate-pulse"
              />
            </div>
            <p className="text-lg text-gray-400">Loading prospects...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1b] via-[#1a1f36] to-[#0a0e1b] text-white">
      <Header />

      <div className="p-6">
        {/* Header */}
        <div className="max-w-[1800px] mx-auto mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent flex items-center gap-3">
                <Users className="h-8 w-8 text-[#FBAE1C]" />
                Prospects
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Overview of all prospects you've researched and added to Cold AI
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRulesModal(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                  activeRulesCount > 0
                    ? 'bg-[#FBAE1C]/20 text-[#FBAE1C] border-[#FBAE1C] hover:bg-[#FBAE1C]/30'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-sm font-medium">Rules</span>
                {activeRulesCount > 0 && (
                  <span className="bg-[#FBAE1C] text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {activeRulesCount}
                  </span>
                )}
              </button>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-400">Total:</span>
                <span className="text-lg font-bold text-white">{prospects.length}</span>
              </div>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { key: 'all', label: 'All', color: '' },
              { key: 'generated', label: 'Generated', color: 'bg-[#3B82F6]' },
              { key: 'pending_scheduled', label: 'Pending', color: 'bg-[#6B7280]' },
              { key: 'scheduled', label: 'Scheduled', color: 'bg-[#F59E0B]' },
              { key: 'sent', label: 'Sent', color: 'bg-[#10B981]' },
              { key: 'reply_received', label: 'Reply Received', color: 'bg-[#EAB308]' },
              { key: 'reply_sent', label: 'Reply Sent', color: 'bg-[#10B981]' },
              { key: 'archived', label: 'Archived', color: 'bg-[#6B7280]' },
              { key: 'failed', label: 'Failed', color: 'bg-[#EF4444]' },
            ] as Array<{ key: StatusFilter; label: string; color: string }>)
              .filter(filter => {
                // Hide pending_scheduled if count is 0
                if (filter.key === 'pending_scheduled' && statusCounts.pending_scheduled === 0) {
                  return false
                }
                // Hide generating states if they have 0 count
                if (['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(filter.key) &&
                    statusCounts[filter.key] === 0) {
                  return false
                }
                return true
              })
              .map(filter => {
                const isActive = activeFilters.includes(filter.key)
                const count = statusCounts[filter.key] || 0
                return (
                  <button
                    key={filter.key}
                    onClick={() => handleFilterToggle(filter.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      isActive
                        ? 'bg-[#FBAE1C]/20 text-[#FBAE1C] border-[#FBAE1C]'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {filter.key !== 'all' && (
                      <span className={`w-2 h-2 rounded-full ${filter.color}`}></span>
                    )}
                    {filter.label}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      isActive ? 'bg-[#FBAE1C]/30' : 'bg-white/10'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by name or job title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1) // Reset to first page when searching
              }}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-transparent"
            />
          </div>
        </div>

        {/* Table */}
        <div className="max-w-[1800px] mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr className="group">
                    {renderSortableHeader('Prospect', 'name')}
                    {renderSortableHeader('LinkedIn Headline', 'jobTitle')}
                    {renderSortableHeader('Status', 'status')}
                    <th
                      onClick={() => handleSort('messages')}
                      className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-[#FBAE1C] transition-colors select-none"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>Messages</span>
                        {sortColumn === 'messages' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-[#FBAE1C]" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-[#FBAE1C]" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                        )}
                      </div>
                    </th>
                    {renderSortableHeader('Added', 'added')}
                    {renderSortableHeader('Scheduled', 'scheduled')}
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedProspects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Users className="h-12 w-12 mb-3 opacity-50" />
                          <p className="text-lg font-medium">No prospects found</p>
                          <p className="text-sm mt-1">
                            {searchQuery || !activeFilters.includes('all') ? 'Try adjusting your search or filters' : 'Start by generating messages for prospects'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedProspects.map((prospect) => (
                      <tr
                        key={prospect.id}
                        onClick={() => handleProspectClick(prospect.id)}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <img
                              src={prospect.avatar}
                              alt={prospect.name}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget
                                if (target.src.includes('ui-avatars.com')) return
                                const name = prospect.name || 'Unknown'
                                const bgColor = ['FBAE1C', 'FC9109', '8B5CF6', '3B82F6', '10B981'][Math.abs(prospect.id) % 5]
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bgColor}&color=fff&size=128&rounded=true`
                              }}
                            />
                            <div>
                              <div className="text-sm font-medium text-white">{prospect.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-300">{prospect.jobTitle}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(prospect.messageStatus)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${getMessageCountBadgeColor(prospect.messageStatus)} text-white text-sm font-bold`}>
                            {prospect.messageCount}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Calendar className="h-4 w-4" />
                            {prospect.createdAt.toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {prospect.scheduledFor ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <MessageSquare className="h-4 w-4" />
                              {prospect.scheduledFor.toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="relative inline-block">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuProspectId(openMenuProspectId === prospect.id ? null : prospect.id)
                              }}
                              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                              <MoreVertical className="h-4 w-4 text-gray-400" />
                            </button>

                            {openMenuProspectId === prospect.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenMenuProspectId(null)
                                  }}
                                />
                                <div className="absolute right-0 mt-1 w-48 bg-[#1a1f36] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                                  <a
                                    href={prospect.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenMenuProspectId(null)
                                    }}
                                    className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    View Profile
                                  </a>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenMenuProspectId(null)
                                      setDeleteConfirmProspect({ id: prospect.researchCacheId, name: prospect.name })
                                    }}
                                    className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Remove Prospect
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {filteredAndSortedProspects.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              {/* Left: Summary */}
              <div className="text-sm text-gray-400">
                Showing{' '}
                <span className="font-medium text-white">
                  {(currentPage - 1) * PROSPECTS_PER_PAGE + 1}
                </span>
                {' '}-{' '}
                <span className="font-medium text-white">
                  {Math.min(currentPage * PROSPECTS_PER_PAGE, filteredAndSortedProspects.length)}
                </span>
                {' '}of{' '}
                <span className="font-medium text-white">
                  {filteredAndSortedProspects.length}
                </span>
                {' '}prospects
              </div>

              {/* Right: Pagination buttons */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                        : 'bg-white/5 text-gray-300 hover:bg-[#FBAE1C]/20 hover:text-[#FBAE1C] border border-white/10 hover:border-[#FBAE1C]'
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and pages around current
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        )
                      })
                      .map((page, index, array) => {
                        // Add ellipsis if there's a gap
                        const showEllipsisBefore = index > 0 && page - array[index - 1] > 1
                        return (
                          <div key={page} className="flex items-center gap-1">
                            {showEllipsisBefore && (
                              <span className="px-2 text-gray-500">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                                currentPage === page
                                  ? 'bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] text-white'
                                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 hover:border-white/20'
                              }`}
                            >
                              {page}
                            </button>
                          </div>
                        )
                      })}
                  </div>

                  {/* Next button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === totalPages
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                        : 'bg-white/5 text-gray-300 hover:bg-[#FBAE1C]/20 hover:text-[#FBAE1C] border border-white/10 hover:border-[#FBAE1C]'
                    }`}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowRulesModal(false)}>
          <div className="bg-gradient-to-br from-[#0C1725] to-[#1a1f36] border border-white/10 rounded-2xl max-w-[95vw] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-br from-[#0C1725] to-[#1a1f36] border-b border-white/10 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="h-6 w-6 text-[#FBAE1C]" />
                  Prospect Rules
                </h2>
                <p className="text-sm text-gray-400 mt-1">Customize which prospects you see on this page</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRules(DEFAULT_RULES)
                    toast.success('All rules reset')
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-all"
                >
                  Reset All
                </button>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              {/* Quick Presets - Full Width */}
              <div className="mb-8">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    ⚡ Quick Views
                  </h3>
                  <div className="h-px bg-gradient-to-r from-[#FBAE1C]/50 via-[#FBAE1C]/20 to-transparent mb-3" />
                  <p className="text-sm text-gray-400">These presets override all other rules</p>
                </div>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { key: 'hotLeads', label: 'Hot Leads', icon: '🔥', desc: 'Replies in last 14 days' },
                    { key: 'activeOutreach', label: 'Active Outreach', icon: '📬', desc: 'Scheduled/sent, awaiting reply' },
                    { key: 'readyToSchedule', label: 'Ready to Schedule', icon: '✍️', desc: 'Generated but not scheduled' },
                    { key: 'coldLeads', label: 'Cold Leads', icon: '❄️', desc: 'Sent 14+ days ago, no reply' },
                    { key: 'cleanView', label: 'Clean View', icon: '🗃️', desc: 'Hide archived & failed' },
                  ].map(preset => (
                    <button
                      key={preset.key}
                      onClick={() => setRules({ ...DEFAULT_RULES, [preset.key]: !rules[preset.key as keyof ProspectRules] })}
                      className={`p-5 rounded-xl border-2 transition-all duration-300 text-left hover:scale-105 ${
                        rules[preset.key as keyof ProspectRules]
                          ? 'border-[#FBAE1C] bg-[#FBAE1C]/20 shadow-[0_0_20px_rgba(251,174,28,0.3)]'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center gap-2">
                        <span className="text-3xl">{preset.icon}</span>
                        <span className="font-semibold text-white text-sm">{preset.label}</span>
                        <p className="text-xs text-gray-400 leading-tight">{preset.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Layout for Remaining Sections */}
              <div className="grid grid-cols-2 gap-6">
                {/* Time-Based Rules */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                      ⏰ Time-Based Filters
                    </h3>
                    <div className="h-px bg-gradient-to-r from-[#FBAE1C]/50 via-[#FBAE1C]/20 to-transparent mb-3" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="flex-1 text-sm font-medium text-gray-300">Activity in last</label>
                      <select
                        value={rules.activityDays || ''}
                        onChange={(e) => setRules({ ...rules, activityDays: e.target.value ? Number(e.target.value) : null })}
                        className="w-32 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-[#FBAE1C] hover:bg-white/15 transition-all cursor-pointer"
                      >
                        <option value="">No filter</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                        <option value="60">60 days</option>
                        <option value="90">90 days</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 text-sm font-medium text-gray-300">Added in last</label>
                      <select
                        value={rules.addedDays || ''}
                        onChange={(e) => setRules({ ...rules, addedDays: e.target.value ? Number(e.target.value) : null })}
                        className="w-32 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-[#FBAE1C] hover:bg-white/15 transition-all cursor-pointer"
                      >
                        <option value="">No filter</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                        <option value="60">60 days</option>
                        <option value="90">90 days</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 text-sm font-medium text-gray-300">Hide inactive for</label>
                      <select
                        value={rules.hideInactiveDays || ''}
                        onChange={(e) => setRules({ ...rules, hideInactiveDays: e.target.value ? Number(e.target.value) : null })}
                        className="w-32 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-[#FBAE1C] hover:bg-white/15 transition-all cursor-pointer"
                      >
                        <option value="">No filter</option>
                        <option value="30">30+ days</option>
                        <option value="60">60+ days</option>
                        <option value="90">90+ days</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Message Status Rules */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                      📊 Message Status Filters
                    </h3>
                    <div className="h-px bg-gradient-to-r from-[#FBAE1C]/50 via-[#FBAE1C]/20 to-transparent mb-3" />
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: 'hideAllArchived', label: 'Hide all archived messages' },
                      { key: 'onlyAwaitingReply', label: 'Only show sent messages waiting for prospect to reply' },
                      { key: 'onlyReplied', label: 'Only show prospects who replied' },
                      { key: 'hideReplied', label: 'Hide prospects who replied' },
                    ].map(rule => (
                      <label key={rule.key} className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer transition-all border border-white/5 hover:border-white/20">
                        <input
                          type="checkbox"
                          checked={rules[rule.key as keyof ProspectRules] as boolean}
                          onChange={(e) => setRules({ ...rules, [rule.key]: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-600 text-[#FBAE1C] focus:ring-[#FBAE1C] focus:ring-offset-0 bg-white/10 cursor-pointer"
                        />
                        <span className="text-sm text-gray-200">{rule.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Message Count Thresholds */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                      🔢 Message Count Filters
                    </h3>
                    <div className="h-px bg-gradient-to-r from-[#FBAE1C]/50 via-[#FBAE1C]/20 to-transparent mb-3" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="flex-1 text-sm font-medium text-gray-300">Minimum messages</label>
                      <select
                        value={rules.minMessages || ''}
                        onChange={(e) => setRules({ ...rules, minMessages: e.target.value ? Number(e.target.value) : null })}
                        className="w-32 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-[#FBAE1C] hover:bg-white/15 transition-all cursor-pointer"
                      >
                        <option value="">No minimum</option>
                        <option value="2">2+</option>
                        <option value="3">3+</option>
                        <option value="5">5+</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 text-sm font-medium text-gray-300">Maximum messages</label>
                      <select
                        value={rules.maxMessages || ''}
                        onChange={(e) => setRules({ ...rules, maxMessages: e.target.value ? Number(e.target.value) : null })}
                        className="w-32 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-[#FBAE1C] hover:bg-white/15 transition-all cursor-pointer"
                      >
                        <option value="">No maximum</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="5">5</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Action Required Rules */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                      ⚠️ Action Required Filters
                    </h3>
                    <div className="h-px bg-gradient-to-r from-[#FBAE1C]/50 via-[#FBAE1C]/20 to-transparent mb-3" />
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: 'onlyGenerated', label: 'Only show generated (not scheduled)' },
                      { key: 'onlyPendingScheduled', label: 'Only show pending scheduled' },
                      { key: 'onlyFailed', label: 'Only show failed messages' },
                    ].map(rule => (
                      <label key={rule.key} className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer transition-all border border-white/5 hover:border-white/20">
                        <input
                          type="checkbox"
                          checked={rules[rule.key as keyof ProspectRules] as boolean}
                          onChange={(e) => setRules({ ...rules, [rule.key]: e.target.checked })}
                          className="w-5 h-5 rounded border-gray-600 text-[#FBAE1C] focus:ring-[#FBAE1C] focus:ring-offset-0 bg-white/10 cursor-pointer"
                        />
                        <span className="text-sm text-gray-200">{rule.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gradient-to-br from-[#0C1725] to-[#1a1f36] border-t border-white/10 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {activeRulesCount > 0 ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#FBAE1C]/20 border-2 border-[#FBAE1C] rounded-xl shadow-[0_0_15px_rgba(251,174,28,0.3)]">
                      <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full font-bold text-white text-sm shadow-lg">
                        {activeRulesCount}
                      </div>
                      <span className="text-sm font-semibold text-[#FBAE1C]">
                        Active Rule{activeRulesCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">Filtering your prospects</span>
                  </>
                ) : (
                  <span className="text-sm text-gray-400">No active rules - showing all prospects</span>
                )}
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-8 py-3 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-bold rounded-xl hover:scale-105 hover:shadow-[0_0_30px_rgba(251,174,28,0.5)] transition-all duration-200"
              >
                Apply Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirmProspect(null)}>
          <div className="bg-gradient-to-br from-[#0C1725] to-[#1a1f36] border border-white/10 rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">Remove Prospect?</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Are you sure you want to remove <span className="font-semibold text-white">{deleteConfirmProspect.name}</span>? This will hide them from your prospects list.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDeleteConfirmProspect(null)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRemoveProspect(deleteConfirmProspect.id)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Removing...
                      </>
                    ) : (
                      'Remove'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
