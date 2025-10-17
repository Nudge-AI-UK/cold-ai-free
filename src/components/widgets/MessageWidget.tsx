import { useState, useEffect } from 'react'
import { Zap, Send, Copy, AlertCircle, Save } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { unipileService } from '@/services/unipileService'

interface MessageWidgetProps {
  forceEmpty?: boolean
  className?: string
}

const validateLinkedInUrl = (url: string): boolean => {
  if (!url) return false
  // Allow alphanumeric, hyphens, underscores, and URL-encoded characters (like emojis: %F0%9F%94%AD)
  const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w%-]+\/?$/
  return linkedinRegex.test(url)
}

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

export function MessageWidget({ forceEmpty, className }: MessageWidgetProps) {
  const { user } = useAuth()
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  const [linkedinError, setLinkedinError] = useState('')
  const [setupStatus, setSetupStatus] = useState({
    settings: { personal: false, company: false, communication: false },
    product: false,
    icp: false,
    linkedin: false
  })
  const [icpData, setIcpData] = useState<any>(null)
  const [productData, setProductData] = useState<any>(null)
  const [messageType, setMessageType] = useState('first_message')
  const [outreachGoal, setOutreachGoal] = useState('meeting')
  const [progressStatus, setProgressStatus] = useState<string>('')
  const [currentLogId, setCurrentLogId] = useState<number | null>(null)
  const [editedMessage, setEditedMessage] = useState<string>('')
  const [isSending, setIsSending] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [recipientUrl, setRecipientUrl] = useState<string>('')
  const [isCheckingSetup, setIsCheckingSetup] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    if (user && !forceEmpty) {
      checkSetupStatus()
      checkForInProgressGeneration()
    }
  }, [user, forceEmpty])

  // Timeout mechanism - detect stuck generations after 2 minutes of no updates
  useEffect(() => {
    if (!currentLogId || !isGenerating || !lastUpdateTime) return

    const checkTimeout = setInterval(() => {
      const elapsed = Date.now() - lastUpdateTime.getTime()
      const TWO_MINUTES = 2 * 60 * 1000

      if (elapsed > TWO_MINUTES) {
        console.warn('⏰ Generation appears stuck - no progress for 2 minutes')
        setIsStuck(true)
        toast.error('Message generation timed out. Please try again.')
      }
    }, 10000) // Check every 10 seconds

    return () => clearInterval(checkTimeout)
  }, [currentLogId, isGenerating, lastUpdateTime])

  // Check for any in-progress message generation on mount
  const checkForInProgressGeneration = async () => {
    if (!user) return

    const userId = user?.id || user?.user_id

    // Check for the most recent message generation log that's in-progress or generated (not archived/sent)
    const { data: existingLog, error: logError } = await supabase
      .from('message_generation_logs')
      .select('id, message_status, generated_message, edited_message, created_at, updated_at')
      .eq('user_id', userId)
      .or('message_status.eq.analysing_prospect,message_status.eq.researching_product,message_status.eq.analysing_icp,message_status.eq.generating_message,message_status.eq.generated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (logError) {
      console.error('❌ Error checking for in-progress generation:', logError)
      return
    }

    if (existingLog) {
      console.log('📝 Found existing message log:', existingLog)
      setCurrentLogId(existingLog.id)

      // Check if it's in progress
      if (['analysing_prospect', 'researching_product', 'analysing_icp', 'generating_message'].includes(existingLog.message_status)) {
        const updatedAt = new Date(existingLog.updated_at)
        const elapsed = Date.now() - updatedAt.getTime()
        const TWO_MINUTES = 2 * 60 * 1000

        // Check if the generation is stuck (no update for 2 minutes)
        if (elapsed > TWO_MINUTES) {
          console.warn('⏰ Found stuck generation - last update:', updatedAt)
          setIsStuck(true)
          setProgressStatus(existingLog.message_status)
          setIsGenerating(false)
          toast.error('Previous message generation timed out. Please reset and try again.')
        } else {
          setProgressStatus(existingLog.message_status)
          setIsGenerating(true)
          setLastUpdateTime(updatedAt)
          toast.info('Resuming message generation...')
        }
      } else if (existingLog.message_status === 'generated' && existingLog.generated_message) {
        // Load completed message
        setGeneratedMessage(parseMessage(existingLog.generated_message))
        if (existingLog.edited_message) {
          setEditedMessage(parseMessage(existingLog.edited_message))
        }
        setProgressStatus('generated')
        setIsGenerating(false)
      }
    }
  }

  // Auto-save edited message (debounced)
  useEffect(() => {
    if (!currentLogId) return

    console.log('💾 Auto-saving edited message...', { currentLogId, editedLength: editedMessage?.length || 0, matchesOriginal: editedMessage === generatedMessage })
    const timer = setTimeout(async () => {
      // If edited message is empty or matches the original, save NULL to indicate no edits
      const valueToSave = (!editedMessage || editedMessage === generatedMessage) ? null : editedMessage

      const { data, error } = await supabase
        .from('message_generation_logs')
        .update({ edited_message: valueToSave })
        .eq('id', currentLogId)
        .select()

      if (error) {
        console.error('❌ Failed to save edited message:', error)
      } else {
        console.log('✅ Edited message saved:', data)
      }
    }, 1000) // Save 1s after user stops typing

    return () => clearTimeout(timer)
  }, [editedMessage, currentLogId, generatedMessage])

  // Real-time subscriptions for automatic updates
  useEffect(() => {
    if (!user) return

    const userId = user?.id || user?.user_id
    let debounceTimer: NodeJS.Timeout | null = null

    // Debounced checkSetupStatus to prevent rapid-fire updates
    const debouncedCheckSetupStatus = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        checkSetupStatus()
      }, 500) // Wait 500ms after last change
    }

    // Subscribe to changes in user-related tables
    const channel = supabase
      .channel('message_widget_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 User profile updated:', payload)
          debouncedCheckSetupStatus()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'business_profiles',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Business profile updated:', payload)
          debouncedCheckSetupStatus()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'communication_preferences',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Communication preferences updated:', payload)
          debouncedCheckSetupStatus()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_base',
          filter: `created_by=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Knowledge base updated:', payload)
          debouncedCheckSetupStatus()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'icps',
          filter: `created_by=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 ICP updated:', payload)
          debouncedCheckSetupStatus()
        }
      )
      .subscribe((status) => {
        console.log('🔌 Subscription status:', status)
      })

    // Cleanup subscription on unmount
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [user])

  // Removed aggressive refresh mechanisms to prevent infinite loops
  // Real-time subscriptions below handle updates automatically

  // Subscribe to message generation progress
  useEffect(() => {
    if (!currentLogId) return

    console.log('📡 Subscribing to message generation progress for log_id:', currentLogId)

    const channel = supabase
      .channel(`message_progress_${currentLogId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_generation_logs',
          filter: `id=eq.${currentLogId}`
        },
        (payload) => {
          console.log('🔄 Message generation progress update:', payload)
          const newData = payload.new as any
          const oldData = payload.old as any

          // Ignore updates that only change edited_message (from our own auto-save)
          const isOnlyEditedMessageChange =
            newData.edited_message !== oldData.edited_message &&
            newData.generated_message === oldData.generated_message &&
            newData.message_status === oldData.message_status

          if (isOnlyEditedMessageChange) {
            console.log('⏭️ Ignoring auto-save update (edited_message only)')
            return
          }

          // Update progress status from message_status
          if (newData.message_status) {
            setProgressStatus(newData.message_status)
            console.log('📊 Progress:', newData.message_status)
            // Reset timeout timer on any progress update
            setLastUpdateTime(new Date())
            setIsStuck(false)
          }

          // Check if generation is complete (only reset on first completion)
          if (newData.generated_message && newData.message_status === 'generated' && !generatedMessage) {
            console.log('✅ Message generation complete!')
            setGeneratedMessage(parseMessage(newData.generated_message))
            setEditedMessage('') // Reset edited message for new generation
            setProgressStatus('generated')
            setIsGenerating(false)
          }

          // Check if generation failed
          if (newData.message_status === 'failed') {
            console.error('❌ Message generation failed:', newData.message_metadata?.error)
            toast.error(newData.message_metadata?.error || 'Message generation failed')
            setProgressStatus('')
            setIsGenerating(false)
            setCurrentLogId(null)
          }
        }
      )
      .subscribe((status) => {
        console.log('🔌 Message progress subscription status:', status)
      })

    return () => {
      console.log('🔌 Unsubscribing from message progress')
      supabase.removeChannel(channel)
    }
  }, [currentLogId])

  const checkSetupStatus = async () => {
    if (!user || isCheckingSetup) return

    setIsCheckingSetup(true)
    const userId = user?.id || user?.user_id
    // Check user profiles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Check business profiles
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Check communication preferences
    const { data: commPrefs } = await supabase
      .from('communication_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Check knowledge base
    const { data: knowledgeBase, error: kbError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('created_by', userId)
      .limit(1)
      .single()

    console.log('📚 Knowledge Base Query:', { knowledgeBase, kbError, userId })

    // Check ICPs
    const { data: icp, error: icpError } = await supabase
      .from('icps')
      .select('*')
      .eq('created_by', userId)
      .limit(1)
      .single()

    console.log('🎯 ICP Query:', { icp, icpError, userId })

    // Check LinkedIn connection
    const linkedinStatus = await unipileService.checkLinkedInStatus(userId)
    console.log('🔗 LinkedIn Status:', linkedinStatus)

    const status = {
      settings: {
        personal: !!userProfile,
        company: !!businessProfile,
        communication: !!commPrefs
      },
      product: !!knowledgeBase && knowledgeBase.review_status === 'approved',
      // ICP is ready when approved (even if still reviewing), or fully active
      icp: !!icp && (
        (icp.workflow_status === 'reviewing' && icp.review_status === 'approved') ||
        icp.is_active === true
      ),
      linkedin: linkedinStatus.connected
    }

    console.log('📊 Setup Status:', status)

    // Store actual data for display
    setIcpData(icp)
    setProductData(knowledgeBase)

    // Set message type - always first_message for initial outreach
    setMessageType('first_message')

    // Set outreach goal from communication preferences
    if (commPrefs && commPrefs.cta_preference) {
      setOutreachGoal(commPrefs.cta_preference)
    }

    setSetupStatus(status)
    setSetupComplete(
      status.settings.personal &&
      status.settings.company &&
      status.settings.communication &&
      status.product &&
      status.icp &&
      status.linkedin
    )

    setIsCheckingSetup(false)
  }

  const handleGenerate = async () => {
    if (!linkedinUrl) {
      toast.error('Please enter a LinkedIn URL')
      setLinkedinError('LinkedIn URL is required')
      return
    }

    if (!validateLinkedInUrl(linkedinUrl)) {
      toast.error('Please enter a valid LinkedIn URL')
      setLinkedinError('Invalid LinkedIn URL format. Expected: https://linkedin.com/in/username')
      return
    }

    if (!user) {
      toast.error('Please log in to generate messages')
      return
    }

    setIsGenerating(true)
    setGeneratedMessage('') // Clear previous message
    setEditedMessage('') // Clear any previous edits
    setProgressStatus('') // Will be set by n8n workflow
    setLastUpdateTime(new Date()) // Start timeout timer
    setIsStuck(false) // Reset stuck flag

    try {
      const userId = user?.id || user?.user_id

      // Get current user session for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('Authentication required')
      }

      // Prepare request payload
      const payload = {
        user_id: userId,
        prospect_data: {
          linkedin_url: linkedinUrl
        },
        message_type: messageType,
        outreach_goal: outreachGoal,
        product_id: productData?.id || null,
        icp_id: icpData?.id || null
      }

      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/message-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      // Get the log_id from the response
      const result = await response.json()
      const logId = result.log_id

      if (!logId) {
        throw new Error('No log_id returned from server')
      }

      console.log('📝 Message generation started, log_id:', logId)

      // Set the log ID to trigger subscription
      setCurrentLogId(logId)
      setRecipientUrl(linkedinUrl)

      // The subscription will handle updates and final message
      // Generation continues in the background via n8n workflow

    } catch (error: any) {
      console.error('❌ Failed to generate message:', error)

      // Try to parse structured error response
      try {
        const errorData = typeof error === 'string' ? JSON.parse(error) : error

        if (errorData.error_type === 'MONTHLY_LIMIT_EXCEEDED') {
          toast.error(`Monthly limit reached (${errorData.details?.limits?.messages_used}/${errorData.details?.limits?.messages_limit}). ${errorData.details?.suggestion || 'Upgrade your plan'}`)
        } else if (errorData.error_type === 'LINKEDIN_CONNECTION_REQUIRED') {
          toast.error(`LinkedIn connection required. ${errorData.details?.suggestion || 'Connect your LinkedIn in Settings'}`)
        } else {
          toast.error(errorData.message || errorData.error || 'Failed to generate message')
        }
      } catch (parseError) {
        // Fallback to generic error message
        toast.error(error.message || 'Failed to generate message')
      }

      setGeneratedMessage('') // Clear on error
      setEditedMessage('') // Clear edited message on error
      setProgressStatus('') // Clear progress on error
      setCurrentLogId(null) // Clear log ID on error
      setIsGenerating(false) // Stop generating on error
    }
  }

  const handleSendMessage = async () => {
    if (!user || !currentLogId) return

    setIsSending(true)
    try {
      const userId = user?.id || user?.user_id
      const messageText = editedMessage || generatedMessage

      if (!recipientUrl) {
        toast.error('No recipient LinkedIn URL found')
        return
      }

      // Call Supabase Edge Function to send message via Unipile
      const { data, error } = await supabase.functions.invoke('linkedin-send-message', {
        body: {
          user_id: userId,
          message_log_id: currentLogId,
          recipient_linkedin_url: recipientUrl,
          message_text: messageText
        }
      })

      if (error) throw error

      if (!data.success) {
        throw new Error(data.error || 'Failed to send message')
      }

      toast.success('Message sent successfully via LinkedIn!')

      // Reset widget to Ready state
      resetWidget()

    } catch (error: any) {
      console.error('❌ Error sending message:', error)
      toast.error(error.message || 'Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleArchiveMessage = async () => {
    if (!currentLogId) return

    setIsArchiving(true)
    try {
      const { error } = await supabase
        .from('message_generation_logs')
        .update({
          message_status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentLogId)

      if (error) throw error

      toast.success('Message archived successfully!')

      // Reset widget to Ready state
      resetWidget()

    } catch (error: any) {
      console.error('❌ Error archiving message:', error)
      toast.error('Failed to archive message')
    } finally {
      setIsArchiving(false)
    }
  }

  const resetWidget = () => {
    setGeneratedMessage('')
    setEditedMessage('')
    setProgressStatus('')
    setCurrentLogId(null)
    setIsGenerating(false)
    setLinkedinUrl('')
    setRecipientUrl('')
    setGenerationStartTime(null)
    setIsStuck(false)
  }

  const handleResetStuckGeneration = async () => {
    if (!currentLogId) return

    try {
      // Mark the stuck generation as failed
      const { error } = await supabase
        .from('message_generation_logs')
        .update({
          message_status: 'failed',
          message_metadata: { error: 'Generation timed out - no progress for 2 minutes' },
          updated_at: new Date().toISOString()
        })
        .eq('id', currentLogId)

      if (error) throw error

      toast.success('Reset complete. You can try generating again.')
      resetWidget()

    } catch (error: any) {
      console.error('❌ Error resetting stuck generation:', error)
      toast.error('Failed to reset. Please refresh the page.')
    }
  }

  const copyToClipboard = async () => {
    const messageToCopy = editedMessage || generatedMessage
    navigator.clipboard.writeText(messageToCopy)

    // Save edited version if it's different from original
    if (editedMessage && editedMessage !== generatedMessage && currentLogId) {
      console.log('💾 Saving edited message on copy...')
      await supabase
        .from('message_generation_logs')
        .update({ edited_message: editedMessage })
        .eq('id', currentLogId)
    }

    toast.success('Message copied to clipboard!')
  }

  const settingsCount = Object.values(setupStatus.settings).filter(Boolean).length

  // Setup Required State
  if (forceEmpty || !setupComplete) {
    return (
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-full text-xs flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
            <span>Setup Required</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex items-center gap-6 mb-6">
          {/* Floating Icon (greyed out) */}
          <div className="relative inline-block opacity-50" style={{ animation: 'float 3s ease-in-out infinite' }}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-600/20 to-gray-700/20 flex items-center justify-center border border-gray-600/30">
              <span className="text-4xl grayscale">✨</span>
            </div>
            <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
              AI
            </div>
          </div>
          
          {/* Title and Description */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2 text-gray-400">
              Generate Message
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Complete setup to unlock AI-powered message generation
            </p>
          </div>
        </div>

        {/* Prerequisites Alert */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-400 mb-2">Complete these steps to enable message generation:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    settingsCount === 3 ? 'border-green-500 bg-green-500/20' : 'border-gray-500'
                  }`}>
                    <span className={settingsCount === 3 ? 'text-green-400' : 'text-gray-500'}>✓</span>
                  </div>
                  <span className={settingsCount === 3 ? 'text-gray-300' : 'text-gray-400'}>
                    Configure Settings ({settingsCount}/3 complete)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    setupStatus.product ? 'border-green-500 bg-green-500/20' : 'border-gray-500'
                  }`}>
                    <span className={setupStatus.product ? 'text-green-400' : 'text-gray-500'}>✓</span>
                  </div>
                  <span className={setupStatus.product ? 'text-gray-300' : 'text-gray-400'}>
                    Add Product/Service Entry
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    setupStatus.icp ? 'border-green-500 bg-green-500/20' : 'border-gray-500'
                  }`}>
                    <span className={setupStatus.icp ? 'text-green-400' : 'text-gray-500'}>✓</span>
                  </div>
                  <span className={setupStatus.icp ? 'text-gray-300' : 'text-gray-400'}>
                    Create an ICP with Cold AI
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    setupStatus.linkedin ? 'border-green-500 bg-green-500/20' : 'border-gray-500'
                  }`}>
                    <span className={setupStatus.linkedin ? 'text-green-400' : 'text-gray-500'}>✓</span>
                  </div>
                  <span className={setupStatus.linkedin ? 'text-gray-300' : 'text-gray-400'}>
                    Connect LinkedIn Account
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex gap-6 opacity-50">
          {/* Left Side - Input Section */}
          <div className="flex-1">
            <div className="space-y-4">
              {/* LinkedIn URL Input (Disabled) */}
              <div>
                <label className="block text-xs font-medium text-white/30 uppercase tracking-wide mb-2">
                  LinkedIn Profile URL
                </label>
                <div className="relative">
                  <input 
                    type="url" 
                    placeholder="Complete setup to enable" 
                    className="w-full bg-black/30 opacity-50 border border-white/5 rounded-xl px-4 py-3 pr-12 text-gray-600 placeholder-gray-600 cursor-not-allowed"
                    disabled
                  />
                </div>
              </div>

              {/* Configuration Options (Empty State) */}
              <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">ICP Profile</span>
                    <span className="text-xs font-medium text-gray-600">Not configured</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Message Type</span>
                    <span className="text-xs font-medium text-gray-600">--</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Product Context</span>
                    <span className="text-xs font-medium text-gray-600">Not added</span>
                  </div>
                </div>
              </div>

              {/* Generate Button (Disabled) */}
              <button className="w-full bg-gray-700/30 text-gray-500 font-semibold py-3 px-6 rounded-xl text-sm flex items-center justify-center space-x-2 cursor-not-allowed" disabled>
                <Zap className="w-5 h-5" />
                <span>Complete Setup to Generate</span>
              </button>
            </div>
          </div>

          {/* Center Divider */}
          <div className="w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>

          {/* Right Side - Message Output */}
          <div className="flex-1">
            <div className="space-y-4">
              {/* Message Output Area */}
              <div>
                <label className="block text-xs font-medium text-white/30 uppercase tracking-wide mb-2">
                  Generated Message
                </label>
                <div className="bg-black/30 rounded-xl border border-white/5 p-4 text-sm text-gray-600 leading-relaxed min-h-[200px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl mb-3 opacity-30 grayscale">🔒</div>
                    <p className="text-xs">Message generation locked</p>
                    <p className="text-xs text-gray-700 mt-1">Complete setup requirements first</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons (All Disabled) */}
              <div className="flex gap-3">
                <button className="flex-1 bg-gray-700/30 text-gray-600 font-semibold py-3 px-6 rounded-xl text-sm flex items-center justify-center space-x-2 cursor-not-allowed" disabled>
                  <Send className="w-5 h-5" />
                  <span>Send Message</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements (dimmed) */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-600/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-gray-700/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Ready State
  return (
    <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
         style={{
           background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
           backdropFilter: 'blur(10px)',
           WebkitBackdropFilter: 'blur(10px)'
         }}>
      
      {/* Status Badge */}
      <div className="absolute top-4 right-4 z-30">
        <div className="bg-green-700/50 text-green-400 border border-green-600/50 px-3 py-1 rounded-full text-xs flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Ready</span>
        </div>
      </div>

      {/* Header Section */}
      <div className="flex items-center gap-6 mb-6">
        {/* Floating Icon */}
        <div className="relative inline-block" style={{ animation: 'float 3s ease-in-out infinite' }}>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
            <span className="text-4xl">✨</span>
          </div>
          <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
            AI
          </div>
        </div>
        
        {/* Title and Description */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2"
              style={{
                background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'shimmer 3s linear infinite'
              }}>
            Generate Message
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Enter a LinkedIn profile URL to generate personalised outreach
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Left Side - Input Section */}
        <div className="flex-1">
          <div className="space-y-4">
            {/* LinkedIn URL Input */}
            <div>
              <label className="block text-xs font-medium text-white/70 uppercase tracking-wide mb-2">
                LinkedIn Profile URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => {
                    setLinkedinUrl(e.target.value)
                    setLinkedinError('')
                  }}
                  onBlur={(e) => {
                    if (e.target.value && !validateLinkedInUrl(e.target.value)) {
                      setLinkedinError('Invalid LinkedIn URL format. Expected: https://linkedin.com/in/username')
                    }
                  }}
                  placeholder="https://linkedin.com/in/example"
                  className={`w-full bg-black/30 border rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none transition-all duration-200 ${
                    linkedinError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-white/10 focus:border-[#FBAE1C]/50'
                  }`}
                />
              </div>
              {linkedinError && (
                <p className="text-xs text-red-400 mt-1">{linkedinError}</p>
              )}
            </div>

            {/* Configuration Options */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/5">
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 mb-1">ICP Profile</span>
                    <span className="text-xs font-medium text-[#FBAE1C]">
                      {icpData?.icp_name || 'Not set'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 mb-1">Outreach Goal</span>
                    <span className="text-xs font-medium text-[#FBAE1C] capitalize">
                      {outreachGoal === 'meeting' ? 'Book Meeting' :
                       outreachGoal === 'call' ? 'Schedule Call' :
                       outreachGoal === 'email' ? 'Reply via Email' :
                       outreachGoal === 'soft' ? 'Soft Ask' : 'Book Meeting'}
                    </span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 mb-1">Product Context</span>
                    <span className="text-xs font-medium text-[#FBAE1C]">
                      {productData?.title || 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Button / Reset Button */}
            {isStuck ? (
              <button
                onClick={handleResetStuckGeneration}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2">
                <AlertCircle className="w-5 h-5" />
                <span>Reset & Try Again</span>
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group disabled:opacity-50">
                <Zap className={`w-5 h-5 ${isGenerating ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span>{isGenerating ? 'Generating...' : 'Generate Message'}</span>
              </button>
            )}

            {/* Quick Tips */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>💡 Tip: The AI analyses the prospect's profile to craft personalised messages</p>
            </div>
          </div>
        </div>

        {/* Center Divider */}
        <div className="w-px bg-gradient-to-b from-transparent via-[#FBAE1C]/30 to-transparent"></div>

        {/* Right Side - Message Output */}
        <div className="flex-1">
          <div className="space-y-4">
            {/* Message Output Area */}
            <div>
              <label className="block text-xs font-medium text-white/70 uppercase tracking-wide mb-2">
                Generated Message
              </label>
              <div className="bg-black/30 rounded-xl border border-white/10 min-h-[200px]">
                {generatedMessage ? (
                  <textarea
                    value={editedMessage || generatedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    className="w-full h-full min-h-[200px] bg-transparent p-4 text-sm leading-relaxed text-gray-300 resize-none focus:outline-none focus:ring-1 focus:ring-[#FBAE1C]/50 rounded-xl"
                    placeholder="Your generated message will appear here..."
                  />
                ) : progressStatus ? (
                  <div className="text-gray-400 p-4">
                    {isStuck ? (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-red-400" />
                          <span className="text-sm font-medium text-red-400">Generation Timed Out</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">
                          The message generation has been stuck for over 2 minutes. This usually happens when the workflow was interrupted.
                        </p>
                        <p className="text-xs text-gray-400">
                          Click "Reset & Try Again" below to start fresh.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex items-center justify-center">
                            <div className="w-3 h-3 bg-[#FBAE1C] rounded-full animate-pulse"></div>
                            <div className="absolute w-3 h-3 bg-[#FBAE1C] rounded-full animate-ping opacity-75"></div>
                          </div>
                          <span className="text-sm font-medium text-[#FBAE1C] animate-pulse">
                            {progressStatus === 'analysing_prospect' && 'Analysing prospect profile'}
                            {progressStatus === 'researching_product' && 'Researching product context'}
                            {progressStatus === 'analysing_icp' && 'Analysing ICP alignment'}
                            {progressStatus === 'generating_message' && 'Crafting personalised message'}
                            <span className="inline-block ml-1">
                              <span className="animate-[bounce_1s_ease-in-out_infinite]">.</span>
                              <span className="animate-[bounce_1s_ease-in-out_0.1s_infinite]">.</span>
                              <span className="animate-[bounce_1s_ease-in-out_0.2s_infinite]">.</span>
                            </span>
                          </span>
                        </div>
                        <div className="space-y-3 pl-1">
                      {/* Analysing prospect */}
                      <div className={`flex items-start gap-3 transition-all duration-500 ${
                        progressStatus === 'analysing_prospect' ? 'scale-105' : ''
                      }`}>
                        <div className="relative flex items-center justify-center mt-1">
                          {progressStatus === 'analysing_prospect' ? (
                            <>
                              <div className="w-2 h-2 bg-[#FBAE1C] rounded-full animate-pulse"></div>
                              <div className="absolute w-2 h-2 bg-[#FBAE1C] rounded-full animate-ping"></div>
                            </>
                          ) : (progressStatus === 'researching_product' || progressStatus === 'analysing_icp' || progressStatus === 'generating_message') ? (
                            <div className="w-2 h-2 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-sm transition-colors duration-300 ${
                          progressStatus === 'analysing_prospect' ? 'text-gray-200 font-medium' :
                          (progressStatus === 'researching_product' || progressStatus === 'analysing_icp' || progressStatus === 'generating_message') ? 'text-green-400' :
                          'text-gray-600'
                        }`}>
                          Analysing prospect profile
                        </span>
                      </div>

                      {/* Researching product */}
                      <div className={`flex items-start gap-3 transition-all duration-500 ${
                        progressStatus === 'researching_product' ? 'scale-105' : ''
                      }`}>
                        <div className="relative flex items-center justify-center mt-1">
                          {progressStatus === 'researching_product' ? (
                            <>
                              <div className="w-2 h-2 bg-[#FBAE1C] rounded-full animate-pulse"></div>
                              <div className="absolute w-2 h-2 bg-[#FBAE1C] rounded-full animate-ping"></div>
                            </>
                          ) : (progressStatus === 'analysing_icp' || progressStatus === 'generating_message') ? (
                            <div className="w-2 h-2 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-sm transition-colors duration-300 ${
                          progressStatus === 'researching_product' ? 'text-gray-200 font-medium' :
                          (progressStatus === 'analysing_icp' || progressStatus === 'generating_message') ? 'text-green-400' :
                          'text-gray-600'
                        }`}>
                          Researching product context
                        </span>
                      </div>

                      {/* Analysing ICP */}
                      <div className={`flex items-start gap-3 transition-all duration-500 ${
                        progressStatus === 'analysing_icp' ? 'scale-105' : ''
                      }`}>
                        <div className="relative flex items-center justify-center mt-1">
                          {progressStatus === 'analysing_icp' ? (
                            <>
                              <div className="w-2 h-2 bg-[#FBAE1C] rounded-full animate-pulse"></div>
                              <div className="absolute w-2 h-2 bg-[#FBAE1C] rounded-full animate-ping"></div>
                            </>
                          ) : progressStatus === 'generating_message' ? (
                            <div className="w-2 h-2 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-sm transition-colors duration-300 ${
                          progressStatus === 'analysing_icp' ? 'text-gray-200 font-medium' :
                          progressStatus === 'generating_message' ? 'text-green-400' :
                          'text-gray-600'
                        }`}>
                          Analysing ICP alignment
                        </span>
                      </div>

                      {/* Generating message */}
                      <div className={`flex items-start gap-3 transition-all duration-500 ${
                        progressStatus === 'generating_message' ? 'scale-105' : ''
                      }`}>
                        <div className="relative flex items-center justify-center mt-1">
                          {progressStatus === 'generating_message' ? (
                            <>
                              <div className="w-2 h-2 bg-[#FBAE1C] rounded-full animate-pulse"></div>
                              <div className="absolute w-2 h-2 bg-[#FBAE1C] rounded-full animate-ping"></div>
                            </>
                          ) : (
                            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                          )}
                        </div>
                        <span className={`text-sm transition-colors duration-300 ${
                          progressStatus === 'generating_message' ? 'text-gray-200 font-medium' :
                          'text-gray-600'
                        }`}>
                          Crafting personalised message
                        </span>
                      </div>
                    </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400 p-4">
                    <div className="text-center">
                      <div className="text-3xl mb-3 opacity-50">💬</div>
                      <p className="text-xs">Your personalised message will appear here</p>
                      <p className="text-xs text-gray-600 mt-1">Enter a LinkedIn URL and click Generate</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Message Stats */}
            <div className="flex justify-between text-xs">
              <span className={(editedMessage || generatedMessage).length > 300 ? 'text-red-400 font-medium' : 'text-gray-500'}>
                Character count: {(editedMessage || generatedMessage).length}/300
                {(editedMessage || generatedMessage).length > 300 && ` (${(editedMessage || generatedMessage).length - 300} over limit)`}
              </span>
              {editedMessage && editedMessage !== generatedMessage && (
                <span className="text-[#FBAE1C] text-xs">✏️ Edited</span>
              )}
            </div>
            {(editedMessage || generatedMessage).length > 300 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-400">
                ⚠️ LinkedIn connection requests are limited to 300 characters. This message will be rejected or truncated if the recipient is not an existing connection.
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSendMessage}
                disabled={isSending || !(editedMessage || generatedMessage)}
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-200 text-sm flex items-center justify-center space-x-2 ${
                  (editedMessage || generatedMessage)
                    ? 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white hover:shadow-lg'
                    : 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
                }`}>
                {isSending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
              <button
                onClick={copyToClipboard}
                className={`p-3 rounded-xl border transition-all duration-200 ${
                  (editedMessage || generatedMessage)
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
                    : 'bg-gray-700/30 border-gray-700/30 text-gray-600 cursor-not-allowed'
                }`}
                disabled={!(editedMessage || generatedMessage)}>
                <Copy className="w-5 h-5" />
              </button>
              <button
                onClick={handleArchiveMessage}
                disabled={isArchiving || !(editedMessage || generatedMessage)}
                className={`p-3 rounded-xl border transition-all duration-200 ${
                  (editedMessage || generatedMessage)
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
                    : 'bg-gray-700/30 border-gray-700/30 text-gray-600 cursor-not-allowed'
                }`}>
                {isArchiving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
    </div>
  )
}
