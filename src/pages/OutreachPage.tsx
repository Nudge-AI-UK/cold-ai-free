// src/pages/OutreachPage.tsx
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Header } from '@/components/layout/Header'
import { useProspectModal } from '@/components/modals/ProspectModalManager'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

type ViewMode = 'today' | 'week' | 'month'
type StatusFilter = 'all' | 'generated' | 'pending_scheduled' | 'scheduled' | 'sent' | 'reply-received' | 'reply-sent' | 'archived'

interface Prospect {
  id: number
  name: string
  avatar: string
  status: string
  linkedinUrl: string
  jobTitle?: string
  company?: string
  researchCacheId?: number
}

interface ScheduledMessage {
  id: string
  prospectId: number
  day: number // 0-4 for Mon-Fri
  hour: number // 7-20 (7am-8pm)
  minute: number // 0-59
  status: string
  messageText: string
  scheduledFor: Date // Actual scheduled date from DB
}

export function OutreachPage() {
  const { user } = useAuth()
  const { openProspectModal } = useProspectModal()

  const [currentView, setCurrentView] = useState<ViewMode>('week')
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [draggedMessage, setDraggedMessage] = useState<string | null>(null)
  const [draggedProspect, setDraggedProspect] = useState<Prospect | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<ScheduledMessage | null>(null)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([])
  const [originalScheduledMessages, setOriginalScheduledMessages] = useState<ScheduledMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [isScheduling, setIsScheduling] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [draggedFromSlot, setDraggedFromSlot] = useState<{ day: number; hour: number } | null>(null)
  const [swapPreview, setSwapPreview] = useState<{ fromId: string; toId: string } | null>(null)

  // Update current time every minute for the progress line
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Fetch generated messages (for left prospect cards)
  useEffect(() => {
    if (!user) return

    const fetchGeneratedMessages = async () => {
      try {
        const userId = user.id || user.user_id
        console.log('Fetching prospects for user:', userId)

        const { data, error } = await supabase
          .from('message_generation_logs')
          .select(`
            id,
            message_id,
            generated_message,
            edited_message,
            message_status,
            recipient_linkedin_id,
            recipient_name,
            research_cache_id,
            research_cache (
              id,
              profile_url,
              profile_picture_url,
              research_data
            )
          `)
          .eq('user_id', userId)
          .in('message_status', ['generated', 'archived', 'approved', 'pending_scheduled', 'scheduled', 'sent'])
          .order('created_at', { ascending: false })

        console.log('Raw prospect data from Supabase:', data)
        console.log('Supabase error (if any):', error)

        if (error) throw error

        // Map to Prospect interface
        const mappedProspects: Prospect[] = (data || []).map((msg: any) => ({
          id: msg.id,
          name: msg.recipient_name || msg.research_cache?.research_data?.name || 'Unknown',
          avatar: msg.research_cache?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.recipient_name || 'U')}`,
          status: msg.message_status, // Use actual status from DB instead of hardcoding 'generated'
          linkedinUrl: msg.research_cache?.profile_url || '',
          jobTitle: msg.research_cache?.research_data?.headline || '',
          company: msg.research_cache?.research_data?.company || '',
          researchCacheId: msg.research_cache_id, // Add this for grouping
        }))

        // Filter out archived messages only if the same prospect has scheduled/sent messages
        const activeStatuses = ['pending_scheduled', 'scheduled', 'sent', 'reply_received', 'reply_sent']
        const filteredProspects = mappedProspects.filter(prospect => {
          // If not archived, always show
          if (prospect.status !== 'archived') return true

          // If archived, only show if there are no active/scheduled messages for this prospect
          const hasActiveMessage = mappedProspects.some(
            p => p.researchCacheId === prospect.researchCacheId && activeStatuses.includes(p.status)
          )

          return !hasActiveMessage
        })

        console.log('Mapped prospects:', mappedProspects)
        console.log('Total prospects found:', mappedProspects.length)
        console.log('Filtered prospects (hiding archived with active messages):', filteredProspects)
        console.log('Final count:', filteredProspects.length)

        setProspects(filteredProspects)
      } catch (error) {
        console.error('Error fetching generated messages:', error)
        toast.error(`Failed to load prospects: ${error.message || 'Unknown error'}`)
      }
    }

    fetchGeneratedMessages()
  }, [user])

  // Fetch scheduled messages (for calendar)
  useEffect(() => {
    if (!user) return

    const fetchScheduledMessages = async () => {
      try {
        const userId = user.id || user.user_id

        console.log('📅 Fetching scheduled messages for user:', userId)

        // DEBUG: Check what RLS policy sees
        const { data: debugAuth } = await supabase.rpc('get_current_user_id')
        console.log('🔐 JWT Claims Debug:', debugAuth)

        const { data, error } = await supabase
          .from('sequence_prospects')
          .select('*')
          .eq('user_id', userId)
          .not('scheduled_for', 'is', null)
          .in('status', ['scheduled', 'sending', 'sent'])
          .order('scheduled_for', { ascending: true })

        console.log('📅 Query error:', error)
        console.log('📅 Fetched scheduled prospects from DB:', data)
        console.log('📅 Total prospects fetched:', data?.length || 0)

        if (error) throw error

        // Fetch message texts for each prospect
        const messageLogIds = data?.map(p => p.message_log_id).filter(Boolean) || []
        console.log('📅 Fetching messages for log IDs:', messageLogIds)

        const { data: messageData, error: messageError } = await supabase
          .from('message_generation_logs')
          .select('id, generated_message, edited_message')
          .in('id', messageLogIds)

        console.log('📅 Message data fetched:', messageData)
        console.log('📅 Message fetch error:', messageError)

        // Create a map of message_log_id to message text
        const messageMap = new Map(
          (messageData || []).map(msg => [
            msg.id,
            msg.edited_message || msg.generated_message || 'Message content unavailable'
          ])
        )

        // Map to ScheduledMessage interface
        const mappedMessages: ScheduledMessage[] = (data || []).map((prospect: any) => {
          const scheduledTime = new Date(prospect.scheduled_for)
          const dayOfWeek = scheduledTime.getDay() // 0=Sun, 1=Mon, etc.
          const day = dayOfWeek === 0 ? -1 : dayOfWeek - 1 // Convert to 0=Mon, 4=Fri, -1=weekend (skip)
          const hour = scheduledTime.getHours()
          const minute = scheduledTime.getMinutes()

          // Get message text from the map
          const messageText = messageMap.get(prospect.message_log_id) || 'Message content unavailable'

          return {
            id: prospect.id.toString(),
            prospectId: prospect.message_log_id, // Use message_log_id to match with prospects array
            day: day,
            hour: hour,
            minute: minute,
            status: prospect.status,
            messageText: messageText,
            scheduledFor: scheduledTime, // Store actual scheduled date
          }
        }).filter(msg => {
          const isWeekday = msg.day >= 0 && msg.day <= 4
          const isWorkingHours = msg.hour >= 7 && msg.hour <= 20
          const shouldShow = isWeekday && isWorkingHours

          if (!shouldShow) {
            console.log('📅 Filtered out message:', {
              prospectId: msg.prospectId,
              day: msg.day,
              hour: msg.hour,
              reason: !isWeekday ? 'weekend' : 'outside working hours'
            })
          }

          return shouldShow
        })

        console.log('📅 Messages after filtering (weekdays 7am-8pm):', mappedMessages)
        console.log('📅 Final scheduled messages count:', mappedMessages.length)

        // Debug: Show each message's calendar position
        mappedMessages.forEach(msg => {
          console.log(`📅 Message ${msg.id}: day=${msg.day} (${['Mon','Tue','Wed','Thu','Fri'][msg.day]}), hour=${msg.hour}, minute=${msg.minute}, status=${msg.status}`)
        })

        setScheduledMessages(mappedMessages)
        setOriginalScheduledMessages(mappedMessages) // Store original positions
        setLoading(false)
      } catch (error) {
        console.error('Error fetching scheduled messages:', error)
        toast.error('Failed to load scheduled messages')
        setLoading(false)
      }
    }

    fetchScheduledMessages()
  }, [user])

  // Get status counts
  const getStatusCounts = () => ({
    all: prospects.length,
    generated: prospects.filter(p => p.status === 'generated').length,
    pending_scheduled: prospects.filter(p => p.status === 'pending_scheduled').length,
    scheduled: prospects.filter(p => p.status === 'scheduled').length,
    sent: prospects.filter(p => p.status === 'sent').length,
    'reply-received': prospects.filter(p => p.status === 'reply-received').length,
    'reply-sent': prospects.filter(p => p.status === 'reply-sent').length,
    archived: prospects.filter(p => p.status === 'archived').length,
  })

  const statusCounts = getStatusCounts()

  // Filter prospects
  const filteredProspects = activeFilter === 'all'
    ? prospects
    : prospects.filter(p => p.status === activeFilter)

  // Check if current state matches original state
  const checkForChanges = (currentMessages: ScheduledMessage[]) => {
    if (originalScheduledMessages.length !== currentMessages.length) return true

    return currentMessages.some(msg => {
      const original = originalScheduledMessages.find(o => o.id === msg.id)
      if (!original) return true
      return original.day !== msg.day || original.hour !== msg.hour || original.minute !== msg.minute
    })
  }

  // Handle view changes
  const handleViewChange = (newView: ViewMode) => {
    if (newView === currentView) return
    setCurrentView(newView)
  }

  const handleSaveChanges = async () => {
    if (!user) return

    try {
      // Update scheduled_for times for all changed messages
      const updates = scheduledMessages.map(msg => {
        // Calculate the actual scheduled_for timestamp from day and hour
        const now = new Date()
        const currentDay = now.getDay() // 0=Sun, 1=Mon, etc.
        const mondayOffset = currentDay === 0 ? 1 : (currentDay === 1 ? 0 : -(currentDay - 1))

        const targetDate = new Date(now)
        targetDate.setDate(now.getDate() + mondayOffset + msg.day) // msg.day is 0=Mon, 1=Tue, etc.
        targetDate.setHours(msg.hour, msg.minute, 0, 0)

        return supabase
          .from('sequence_prospects')
          .update({ scheduled_for: targetDate.toISOString() })
          .eq('id', parseInt(msg.id))
      })

      const results = await Promise.all(updates)

      // Check for errors
      const errors = results.filter(r => r.error)
      if (errors.length > 0) {
        console.error('Errors updating scheduled times:', errors)
        toast.error(`Failed to update ${errors.length} message(s)`)
      } else {
        setHasUnsavedChanges(false)
        setOriginalScheduledMessages(scheduledMessages) // Update original to current positions
        toast.success('Changes saved successfully!')
      }
    } catch (error) {
      console.error('Error saving changes:', error)
      toast.error('Failed to save changes')
    }
  }

  const handleProspectClick = async (prospectId: number) => {
    // Prospects on the left are from message_generation_logs
    // We need to fetch their message content
    try {
      const { data, error} = await supabase
        .from('message_generation_logs')
        .select('id, message_id, generated_message, edited_message, message_status')
        .eq('id', prospectId)
        .single()

      if (error) throw error

      if (data) {
        // Create a temporary ScheduledMessage for the modal
        const tempMessage: ScheduledMessage = {
          id: data.message_id,
          prospectId: prospectId,
          day: 0,
          hour: 9,
          minute: 0,
          status: data.message_status,
          messageText: data.edited_message || data.generated_message || '',
          scheduledFor: new Date(), // Default to now for generated messages
        }
        setSelectedMessage(tempMessage)
      }
    } catch (error) {
      console.error('Error fetching prospect message:', error)
      toast.error('Failed to load prospect message')
    }
  }

  const handleProspectDrop = async (prospect: Prospect) => {
    try {
      setIsScheduling(true)
      setDraggedProspect(null)

      if (!user) {
        toast.error('User not authenticated')
        setIsScheduling(false)
        return
      }

      const userId = user.id || user.user_id

      // Get the message details from message_generation_logs
      const { data: messageLog, error: messageError } = await supabase
        .from('message_generation_logs')
        .select(`
          id,
          message_id,
          generated_message,
          edited_message,
          recipient_linkedin_id,
          recipient_name,
          research_cache_id,
          research_cache(
            profile_url,
            research_data
          )
        `)
        .eq('id', prospect.id)
        .single()

      if (messageError || !messageLog) {
        console.error('Error fetching message:', messageError)
        toast.error('Failed to load message details')
        setIsScheduling(false)
        return
      }

      const linkedinUrl = messageLog.research_cache?.profile_url
      const researchData = messageLog.research_cache?.research_data || {}

      if (!linkedinUrl) {
        toast.error('LinkedIn URL not found for this prospect')
        setIsScheduling(false)
        return
      }

      const messageText = messageLog.edited_message || messageLog.generated_message
      if (!messageText) {
        toast.error('No message text found')
        setIsScheduling(false)
        return
      }

      // Step 1: Get or create an active outreach sequence for manual sends using RPC function
      const { data: sequenceId, error: seqError } = await supabase
        .rpc('get_or_create_manual_outreach_sequence', {
          p_user_id: userId
        })

      if (seqError || !sequenceId) {
        console.error('Error getting/creating sequence:', seqError)
        toast.error('Failed to create outreach sequence')
        setIsScheduling(false)
        return
      }

      // Step 2: Create sequence_prospects entry with pending_scheduled status using RPC function
      const scheduledFor = new Date()
      scheduledFor.setMinutes(scheduledFor.getMinutes() + 1) // Schedule for 1 minute from now

      const { data: prospectId, error: prospectError } = await supabase
        .rpc('create_sequence_prospect', {
          p_user_id: userId,
          p_sequence_id: sequenceId,
          p_message_log_id: messageLog.id,
          p_linkedin_url: linkedinUrl,
          p_linkedin_public_id: linkedinUrl.match(/linkedin\.com\/in\/([\w%-]+)\/?/)?.[1] || '',
          p_prospect_name: messageLog.recipient_name || researchData.name || 'Unknown',
          p_prospect_headline: researchData.headline || '',
          p_prospect_company: researchData.company || '',
          p_prospect_data: researchData,
          p_status: 'pending_scheduled',
          p_scheduled_for: scheduledFor.toISOString(),
        })

      if (prospectError || !prospectId) {
        console.error('Error creating sequence prospect:', prospectError)
        toast.error('Failed to schedule message')
        setIsScheduling(false)
        return
      }

      // Step 3: Update message_generation_logs to mark as pending_scheduled
      await supabase
        .from('message_generation_logs')
        .update({
          message_status: 'pending_scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageLog.id)

      toast.success('Message queued! Scheduler will process within 5 minutes.')

      // Wait for UI feedback
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Refresh the data
      window.location.reload()

    } catch (error) {
      console.error('Error handling prospect drop:', error)
      toast.error('Failed to schedule message')
      setIsScheduling(false)
    }
  }

  const handleDragStart = (messageId: string, day: number, hour: number) => {
    setDraggedMessage(messageId)
    setDraggedFromSlot({ day, hour })
  }

  const handleDragEnd = () => {
    setDraggedMessage(null)
    setDraggedFromSlot(null)
    setSwapPreview(null)
  }

  const handleDragOver = (targetMessageId: string | null) => {
    if (draggedMessage && targetMessageId && draggedMessage !== targetMessageId) {
      setSwapPreview({ fromId: draggedMessage, toId: targetMessageId })
    } else {
      setSwapPreview(null)
    }
  }

  const handleNavigateMessage = (direction: 'prev' | 'next') => {
    if (!selectedMessage) return

    const currentIndex = scheduledMessages.findIndex(m => m.id === selectedMessage.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1

    if (newIndex >= 0 && newIndex < scheduledMessages.length) {
      setSelectedMessage(scheduledMessages[newIndex])
    }
  }

  // Handle keyboard navigation
  useEffect(() => {
    if (!selectedMessage) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleNavigateMessage('prev')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNavigateMessage('next')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedMessage, scheduledMessages])

  const handleSwap = (targetMessageId: string) => {
    if (!draggedMessage || draggedMessage === targetMessageId) return

    const draggedMsg = scheduledMessages.find(m => m.id === draggedMessage)
    const targetMsg = scheduledMessages.find(m => m.id === targetMessageId)

    if (!draggedMsg || !targetMsg) return

    // Check if target message is locked (within 10 minutes)
    const now = new Date()
    const targetTime = new Date()
    targetTime.setHours(targetMsg.hour, 0, 0, 0)
    const timeDiff = targetTime.getTime() - now.getTime()

    if (timeDiff < 10 * 60 * 1000 && timeDiff > 0) {
      toast.error('Cannot swap - target message is locked (within 10 minutes of send time)')
      handleDragEnd()
      return
    }

    // Swap the scheduled times (including minutes)
    const newMessages = scheduledMessages.map(msg => {
      if (msg.id === draggedMessage) {
        return { ...msg, day: targetMsg.day, hour: targetMsg.hour, minute: targetMsg.minute }
      }
      if (msg.id === targetMessageId) {
        return { ...msg, day: draggedMsg.day, hour: draggedMsg.hour, minute: draggedMsg.minute }
      }
      return msg
    })

    setScheduledMessages(newMessages)

    // Check if there are actual changes from original
    const hasChanges = checkForChanges(newMessages)
    setHasUnsavedChanges(hasChanges)

    if (hasChanges) {
      toast.success('Messages swapped - click Save Changes')
    } else {
      toast.success('Back to original positions')
    }

    handleDragEnd()
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'generated': 'border-[#3B82F6] bg-[#3B82F6]/10',
      'pending_scheduled': 'border-[#6B7280] bg-[#6B7280]/10',
      'scheduled': 'border-[#F59E0B] bg-[#F59E0B]/10',
      'sending': 'border-[#F59E0B] bg-[#F59E0B]/10', // Same as scheduled
      'sent': 'border-[#10B981] bg-[#10B981]/10',
      'reply-received': 'border-[#EAB308] bg-[#EAB308]/10 animate-pulse-slow',
      'reply-sent': 'border-[#10B981] bg-[#10B981]/10',
      'archived': 'border-[#6B7280] bg-[#6B7280]/10 opacity-70',
      'failed': 'border-[#EF4444] bg-[#EF4444]/10',
    }
    return colors[status] || 'border-gray-500 bg-gray-500/10'
  }

  const renderProspectCard = (prospect: Prospect) => {
    const isPending = prospect.status === 'pending_scheduled'
    const isReplySent = prospect.status === 'reply-sent'

    return (
      <div
        key={prospect.id}
        draggable={!isPending}
        onDragStart={() => !isPending && setDraggedProspect(prospect)}
        onDragEnd={() => setDraggedProspect(null)}
        onClick={() => !isPending && handleProspectClick(prospect.id)}
        className={`${getStatusColor(prospect.status)} border-2 rounded-lg p-2 ${
          isPending ? 'cursor-not-allowed opacity-60' : 'cursor-grab hover:scale-105'
        } transition-all duration-300 ease-in-out hover:shadow-xl flex items-center gap-2 relative`}
      >
        <img
          src={prospect.avatar}
          alt={prospect.name}
          className="w-8 h-8 rounded-full object-cover"
        />
        <div className="text-xs font-medium text-white flex-1">{prospect.name}</div>
        {isPending && (
          <div className="text-xs text-gray-400">⏳</div>
        )}
        {isReplySent && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            2
          </div>
        )}
      </div>
    )
  }

  const renderTimeSlot = (day: number, hour: number) => {
    const slotMessages = scheduledMessages.filter(m => m.day === day && m.hour === hour)
    const hourLabel = hour === 0 ? '12am' : hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`

    // Detect collisions - messages within 10 minutes of each other
    const detectCollisions = (messages: ScheduledMessage[]) => {
      const sorted = [...messages].sort((a, b) => a.minute - b.minute)
      const groups: ScheduledMessage[][] = []

      sorted.forEach(msg => {
        let addedToGroup = false
        for (const group of groups) {
          // Check if this message collides with any in the group
          const collides = group.some(existingMsg =>
            Math.abs(msg.minute - existingMsg.minute) < 10
          )
          if (collides) {
            group.push(msg)
            addedToGroup = true
            break
          }
        }
        if (!addedToGroup) {
          groups.push([msg])
        }
      })

      return groups
    }

    const collisionGroups = detectCollisions(slotMessages)

    // Check if any message in slot is locked (within 10 minutes)
    const now = new Date()
    const hasLockedMessage = slotMessages.some(msg => {
      const msgTime = new Date()
      msgTime.setHours(hour, msg.minute, 0, 0)
      const timeDiff = msgTime.getTime() - now.getTime()
      return timeDiff < 10 * 60 * 1000 && timeDiff > 0
    })

    // Check if current time indicator should be in this slot
    const currentHour = currentTime.getHours()
    const currentMinutes = currentTime.getMinutes()
    const currentDay = currentTime.getDay() // 0=Sun, 1=Mon, etc.
    const currentDayIndex = currentDay === 0 ? -1 : currentDay - 1 // Convert to 0=Mon, 4=Fri
    const isCurrentSlot = currentDayIndex === day && currentHour === hour
    const isWorkingHours = currentHour >= 7 && currentHour <= 20 && currentDayIndex >= 0 && currentDayIndex <= 4

    return (
      <div
        key={`${day}-${hour}`}
        className="p-3 border-b border-white/5 flex-1 transition-colors relative min-h-[80px]"
        style={{ position: 'relative' }}
      >
        <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
          {hourLabel}
          {hasLockedMessage && <span>🔒</span>}
        </div>

        {/* Current time indicator - rendered inside this slot */}
        {isCurrentSlot && isWorkingHours && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-red-500 z-30 pointer-events-none"
            style={{
              top: `calc(32px + ${currentMinutes / 60} * (100% - 32px))`,
            }}
          >
            <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-lg"></div>
            <div className="absolute -right-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-lg"></div>
          </div>
        )}

        {/* Render messages with collision handling */}
        {collisionGroups.map((group, groupIndex) => {
          const groupWidth = 100 / Math.max(group.length, 1)

          return group.map((msg, indexInGroup) => {
            const prospect = prospects.find(p => p.id === msg.prospectId)
            if (!prospect) return null

            // Check if this specific message is locked
            const msgTime = new Date()
            msgTime.setHours(hour, msg.minute, 0, 0)
            const timeDiff = msgTime.getTime() - now.getTime()
            const isLocked = timeDiff < 10 * 60 * 1000 && timeDiff > 0

            const isReplySent = msg.status === 'reply-sent'
            const isSwapTarget = swapPreview?.toId === msg.id
            const isDragging = draggedMessage === msg.id

            // Position message at exact minute within hour (matching red line calculation)
            const leftPosition = indexInGroup * groupWidth
            const width = groupWidth - 2 // Small gap between overlapping

            // Format time display
            const timeLabel = `${hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}:${msg.minute.toString().padStart(2, '0')}${hour >= 12 ? 'pm' : 'am'}`

            return (
              <div
                key={msg.id}
                draggable={!isLocked}
                onDragStart={() => !isLocked && handleDragStart(msg.id, day, hour)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  if (!isLocked && draggedMessage && draggedMessage !== msg.id) {
                    e.preventDefault()
                    handleDragOver(msg.id)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (!isLocked) {
                    handleSwap(msg.id)
                  }
                }}
                onClick={(e) => {
                  // Only open modal if not dragging
                  if (!draggedMessage) {
                    setSelectedMessage(msg)
                  }
                }}
                className={`${getStatusColor(msg.status)} border-2 rounded-lg p-2 flex flex-col gap-1 transition-all absolute z-10 ${
                  isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing hover:scale-105 hover:z-20'
                } ${isDragging ? 'opacity-50 scale-95' : ''} ${isSwapTarget ? 'ring-2 ring-[#FBAE1C] ring-offset-2 ring-offset-gray-900' : ''}`}
                style={{
                  top: `calc(32px + ${msg.minute / 60} * (100% - 32px))`,
                  left: `${leftPosition}%`,
                  width: `${width}%`,
                  minHeight: '60px',
                }}
                title={`Scheduled for ${timeLabel}`}
              >
                <div className="flex items-center gap-2">
                  <img src={prospect.avatar} alt={prospect.name} className="w-6 h-6 rounded-full flex-shrink-0" />
                  <div className="text-xs text-white flex-1 truncate">{prospect.name}</div>
                  {isLocked && <span className="text-xs">🔒</span>}
                  {isReplySent && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      2
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 font-mono text-right">{timeLabel}</div>
              </div>
            )
          })
        })}
      </div>
    )
  }

  const renderCalendar = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 7am-8pm
    const today = new Date()

    // Calculate current time position for the red line
    const currentHour = currentTime.getHours()
    const currentMinutes = currentTime.getMinutes()
    const currentDay = currentTime.getDay() // 0=Sun, 1=Mon, etc.
    const currentDayIndex = currentDay === 0 ? -1 : currentDay - 1 // Convert to 0=Mon, 4=Fri
    const isWorkingHours = currentHour >= 7 && currentHour <= 20 && currentDayIndex >= 0 && currentDayIndex <= 4

    // Calculate percentage through the current hour (for precise positioning)
    const minutesProgress = currentMinutes / 60 * 100

    if (currentView === 'today') {
      const dayName = today.toLocaleDateString('en-GB', { weekday: 'long' })
      const dateStr = today.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
      // Get today's day index (0=Mon, 4=Fri)
      const todayDayOfWeek = today.getDay()
      const todayDayIndex = todayDayOfWeek === 0 ? -1 : todayDayOfWeek - 1

      return (
        <div className="grid grid-cols-[1fr] gap-4 h-full transition-all duration-500 ease-in-out">
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col transition-all duration-500 ease-in-out h-full">
            <div className="bg-white/5 p-3 border-b border-white/10 text-center flex-shrink-0">
              <div className="text-sm font-semibold text-white">{dayName}</div>
              <div className="text-xs text-gray-400 mt-1">{dateStr}</div>
            </div>
            <div className="flex-1 flex flex-col">
              {hours.map(hour => renderTimeSlot(todayDayIndex, hour))}
            </div>
          </div>
        </div>
      )
    }

    if (currentView === 'week') {
      const currentDay = today.getDay()
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay

      return (
        <div className="grid grid-cols-[repeat(5,1fr)] gap-4 h-full transition-all duration-500 ease-in-out">
          {days.map((day, dayIndex) => {
            const date = new Date(today)
            date.setDate(today.getDate() + mondayOffset + dayIndex)
            const dateStr = date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })

            return (
              <div key={day} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col transition-all duration-500 ease-in-out h-full">
                <div className="bg-white/5 p-3 border-b border-white/10 text-center flex-shrink-0">
                  <div className="text-sm font-semibold text-white">{day.substring(0, 3)}</div>
                  <div className="text-xs text-gray-400 mt-1">{dateStr}</div>
                </div>
                <div className="flex-1 flex flex-col">
                  {hours.map(hour => renderTimeSlot(dayIndex, hour))}
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    // Month view (simplified) - shows Week 1 = this week, Week 2 = next week, etc.
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']

    // Get this week's Monday
    const todayDay = today.getDay()
    const mondayOffsetForMonth = todayDay === 0 ? -6 : 1 - todayDay
    const thisWeekMonday = new Date(today)
    thisWeekMonday.setDate(today.getDate() + mondayOffsetForMonth)
    thisWeekMonday.setHours(0, 0, 0, 0)

    return (
      <div className="grid grid-cols-[repeat(4,1fr)] gap-4 h-full transition-all duration-500 ease-in-out">
        {weeks.map((week, weekIndex) => {
          const weekMessages = scheduledMessages.filter(m => {
            // Use the actual scheduled date from the database
            const messageDate = new Date(m.scheduledFor)
            messageDate.setHours(0, 0, 0, 0)

            // Calculate days from thisWeekMonday
            const daysFromMonday = Math.floor((messageDate.getTime() - thisWeekMonday.getTime()) / (1000 * 60 * 60 * 24))

            // Calculate which week from today (0 = this week, 1 = next week, etc.)
            const weekFromToday = Math.floor(daysFromMonday / 7)

            return weekFromToday === weekIndex
          })

          return (
            <div key={week} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all duration-500 ease-in-out">
              <div className="bg-white/5 p-3 border-b border-white/10 text-center">
                <div className="text-sm font-semibold text-white">{week}</div>
                <div className="text-xs text-gray-400 mt-1">{weekMessages.length} scheduled</div>
              </div>
              <div className="p-3 space-y-2">
                {weekMessages.map(msg => {
                  const prospect = prospects.find(p => p.id === msg.prospectId)
                  if (!prospect) return null

                  const isReplySent = msg.status === 'reply-sent'
                  const isSwapTarget = swapPreview?.toId === msg.id
                  const isDragging = draggedMessage === msg.id

                  // Check if locked
                  const now = new Date()
                  const msgTime = new Date()
                  msgTime.setHours(msg.hour, 0, 0, 0)
                  const timeDiff = msgTime.getTime() - now.getTime()
                  const isLocked = timeDiff < 10 * 60 * 1000 && timeDiff > 0

                  return (
                    <div
                      key={msg.id}
                      draggable={!isLocked}
                      onDragStart={() => !isLocked && handleDragStart(msg.id, msg.day, msg.hour)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => {
                        if (!isLocked && draggedMessage && draggedMessage !== msg.id) {
                          e.preventDefault()
                          handleDragOver(msg.id)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (!isLocked) {
                          handleSwap(msg.id)
                        }
                      }}
                      onClick={() => !draggedMessage && setSelectedMessage(msg)}
                      className={`${getStatusColor(msg.status)} border-2 rounded-lg p-2 flex items-center gap-2 transition-all duration-300 relative ${
                        isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing hover:scale-105'
                      } ${isDragging ? 'opacity-50 scale-95' : ''} ${isSwapTarget ? 'ring-2 ring-[#FBAE1C] ring-offset-2 ring-offset-gray-900' : ''}`}
                    >
                      <img src={prospect.avatar} alt={prospect.name} className="w-8 h-8 rounded-full" />
                      <div className="text-xs text-white">{prospect.name}</div>
                      {isLocked && <span className="text-xs">🔒</span>}
                      {isReplySent && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          2
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
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
            <p className="text-lg text-gray-400">Loading outreach calendar...</p>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent">
                Outreach Calendar
              </h1>
              <p className="text-gray-400 text-sm mt-1">Drag messages to schedule sends</p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                {(['today', 'week', 'month'] as ViewMode[]).map(view => (
                  <button
                    key={view}
                    onClick={() => handleViewChange(view)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentView === view
                        ? 'bg-[#FBAE1C] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveChanges}
                disabled={!hasUnsavedChanges}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
                  hasUnsavedChanges
                    ? 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white hover:shadow-lg'
                    : 'bg-gray-700/30 text-gray-500 cursor-not-allowed opacity-50'
                }`}
              >
                <span>💾</span>
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className={`max-w-[1800px] mx-auto grid gap-6 transition-all duration-500 ease-in-out h-[calc(100vh-180px)] ${
          currentView === 'today' ? 'grid-cols-[3fr_1fr]' :
          currentView === 'month' ? 'grid-cols-[1fr_3fr]' :
          'grid-cols-[1fr_1fr]'
        }`}>
          {/* Prospects Section */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col transition-all duration-500 ease-in-out">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <h2 className="text-xl font-semibold">Prospects</h2>
              <span className="bg-[#FBAE1C]/20 text-[#FBAE1C] px-3 py-1 rounded-full text-sm font-semibold">
                {filteredProspects.length}
              </span>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/10">
              {(['all', 'generated', 'pending_scheduled', 'scheduled', 'sent', 'reply-received', 'reply-sent', 'archived'] as StatusFilter[])
                .filter(filter => filter !== 'pending_scheduled' || statusCounts.pending_scheduled > 0) // Only show pending if count > 0
                .map(filter => {
                const statusDotColors: Record<string, string> = {
                  'generated': 'bg-[#3B82F6]',
                  'pending_scheduled': 'bg-[#6B7280]',
                  'scheduled': 'bg-[#F59E0B]',
                  'sent': 'bg-[#10B981]',
                  'reply-received': 'bg-[#EAB308]',
                  'reply-sent': 'bg-[#10B981]',
                  'archived': 'bg-[#6B7280]',
                  'failed': 'bg-[#EF4444]',
                }

                return (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      activeFilter === filter
                        ? 'bg-[#FBAE1C]/20 text-[#FBAE1C] border-[#FBAE1C]'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {filter !== 'all' && (
                      <span className={`w-2 h-2 rounded-full ${statusDotColors[filter]}`}></span>
                    )}
                    {filter === 'all' ? 'All' :
                     filter === 'pending_scheduled' ? 'Pending' :
                     filter === 'reply-received' ? 'Replies' :
                     filter === 'reply-sent' ? 'Responded' :
                     filter.charAt(0).toUpperCase() + filter.slice(1)}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      activeFilter === filter ? 'bg-[#FBAE1C]/30' : 'bg-white/10'
                    }`}>
                      {statusCounts[filter]}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Prospects Grid - Wrapper for scrolling */}
            <div className="overflow-y-auto overflow-x-hidden pr-2 -mr-2">
              <div className={`grid gap-3 p-1 transition-all duration-500 ease-in-out ${
                currentView === 'today' ? 'grid-cols-[repeat(3,1fr)]' :
                currentView === 'month' ? 'grid-cols-[1fr]' :
                'grid-cols-[repeat(2,1fr)]'
              }`}>
                {filteredProspects.map(renderProspectCard)}
              </div>
            </div>
          </section>

          {/* Calendar Section */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-6 overflow-hidden flex flex-col transition-all duration-500 ease-in-out relative">
            {/* Drop Zone Overlay */}
            {draggedProspect && !isScheduling && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault()
                  if (draggedProspect) {
                    await handleProspectDrop(draggedProspect)
                  }
                }}
                className="absolute inset-0 z-10 bg-[#FBAE1C]/20 backdrop-blur-sm border-4 border-dashed border-[#FBAE1C] rounded-xl flex items-center justify-center animate-pulse"
              >
                <div className="text-center">
                  <div className="text-4xl mb-4">📅</div>
                  <div className="text-2xl font-bold text-white mb-2">Ready to send?</div>
                  <div className="text-sm text-gray-300">Drop to schedule this message</div>
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {isScheduling && (
              <div className="absolute inset-0 z-20 bg-[#0C1725]/95 backdrop-blur-md rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FBAE1C]/10 rounded-2xl mb-4">
                    <div className="w-12 h-12 border-4 border-[#FBAE1C] border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-2">Scheduling message...</div>
                  <div className="text-sm text-gray-400">Creating outreach schedule</div>
                </div>
              </div>
            )}

            <div className="flex-1 h-full">
              {renderCalendar()}
            </div>
          </section>
        </main>
      </div>

      {/* Message Detail Modal */}
      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        {selectedMessage && (() => {
          const prospect = prospects.find(p => p.id === selectedMessage.prospectId)
          if (!prospect) return null

          const getStatusBorderColor = (status: string) => {
            const colors: Record<string, string> = {
              'generated': 'border-[#3B82F6]',
              'pending_scheduled': 'border-[#6B7280]',
              'scheduled': 'border-[#F59E0B]',
              'sending': 'border-[#F59E0B]', // Same as scheduled
              'sent': 'border-[#10B981]',
              'reply-received': 'border-[#EAB308]',
              'reply-sent': 'border-[#10B981]',
              'archived': 'border-[#6B7280]',
              'failed': 'border-[#EF4444]',
            }
            return colors[status] || 'border-gray-500'
          }

          const getModalTitle = (status: string) => {
            const titles: Record<string, string> = {
              'generated': 'Generated Message',
              'approved': 'Approved Message',
              'pending_scheduled': 'Pending Message',
              'scheduled': 'Scheduled Message',
              'sending': 'Sending Message',
              'sent': 'Sent Message',
              'reply-received': 'Message (Reply Received)',
              'reply-sent': 'Message (Responded)',
              'archived': 'Archived Message',
            }
            return titles[status] || 'Message'
          }

          const currentIndex = scheduledMessages.findIndex(m => m.id === selectedMessage.id)
          const hasPrev = currentIndex > 0
          const hasNext = currentIndex >= 0 && currentIndex < scheduledMessages.length - 1
          const prevMessage = hasPrev ? scheduledMessages[currentIndex - 1] : null
          const nextMessage = hasNext ? scheduledMessages[currentIndex + 1] : null
          const prevProspect = prevMessage ? prospects.find(p => p.id === prevMessage.prospectId) : null
          const nextProspect = nextMessage ? prospects.find(p => p.id === nextMessage.prospectId) : null

          return (
            <DialogContent className={`bg-[#0C1725] border-2 ${getStatusBorderColor(selectedMessage.status)} max-w-2xl [&>button]:hidden`}>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-2xl font-bold text-white">{getModalTitle(selectedMessage.status)}</DialogTitle>
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Prospect Info */}
                <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <img
                    src={prospect.avatar}
                    alt={prospect.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{prospect.name}</h3>
                    {prospect.jobTitle && prospect.company && (
                      <p className="text-sm text-gray-400 mt-1">
                        {prospect.jobTitle} at {prospect.company}
                      </p>
                    )}
                    <a
                      href={prospect.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#FBAE1C] hover:text-[#FC9109] transition-colors mt-1 inline-flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      View LinkedIn Profile
                    </a>
                  </div>
                </div>

                {/* Message Content */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Message</h4>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-white leading-relaxed">{selectedMessage.messageText}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedMessage(null)
                      openProspectModal(selectedMessage.prospectId, filteredProspects.map(p => p.id))
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                  >
                    View Research
                  </button>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="px-6 py-3 bg-white/5 text-white border border-white/10 font-semibold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Close
                  </button>
                </div>

                {/* Bottom Navigation */}
                {(hasPrev || hasNext) && (
                  <div className="pt-4 border-t border-white/10 -mb-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleNavigateMessage('prev')}
                        disabled={!hasPrev}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                          hasPrev
                            ? 'hover:bg-white/5 cursor-pointer'
                            : 'opacity-0 cursor-default pointer-events-none'
                        }`}
                      >
                        <ChevronLeft className="h-5 w-5 text-gray-400" />
                        {prevProspect && (
                          <>
                            <img
                              src={prevProspect.avatar}
                              alt={prevProspect.name}
                              className="w-8 h-8 rounded-full"
                            />
                            <div className="text-left">
                              <div className="text-sm font-medium text-white">{prevProspect.name}</div>
                              <div className="text-xs text-gray-400">Previous</div>
                            </div>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleNavigateMessage('next')}
                        disabled={!hasNext}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                          hasNext
                            ? 'hover:bg-white/5 cursor-pointer'
                            : 'opacity-0 cursor-default pointer-events-none'
                        }`}
                      >
                        {nextProspect && (
                          <>
                            <div className="text-right">
                              <div className="text-sm font-medium text-white">{nextProspect.name}</div>
                              <div className="text-xs text-gray-400">Next</div>
                            </div>
                            <img
                              src={nextProspect.avatar}
                              alt={nextProspect.name}
                              className="w-8 h-8 rounded-full"
                            />
                          </>
                        )}
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-2">
                      {currentIndex + 1} / {scheduledMessages.length}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          )
        })()}
      </Dialog>
    </div>
  )
}
