import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link2, Settings, ExternalLink, LogOut, Eye, AlertCircle, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { unipileService } from '@/services/unipileService'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { OnboardingArrow } from '@/components/ui/onboarding-arrow'

interface LinkedInWidgetProps {
  forceEmpty?: boolean
  className?: string
}

interface LinkedInProfile {
  id: string
  username: string
  connected: boolean
  profileUrl?: string
  status: string
  lastResearchedAt?: string
  metadata?: {
    profile_url?: string
    profile_picture_url?: string
    occupation?: string
    location?: string
    organization?: string
    first_name?: string
    last_name?: string
    public_identifier?: string
  }
}

export function LinkedInWidget({ forceEmpty, className }: LinkedInWidgetProps) {
  const { user } = useAuth()
  const { currentStep: onboardingStep } = useOnboardingState()
  const [isConnected, setIsConnected] = useState(false)
  const [profile, setProfile] = useState<LinkedInProfile | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Check if this widget should be highlighted for onboarding
  const isOnboardingHighlight = onboardingStep === 'linkedin'

  useEffect(() => {
    if (user && !forceEmpty) {
      checkLinkedInStatus()
    }
  }, [user, forceEmpty])

  const checkLinkedInStatus = async () => {
    if (!user) return

    const userId = user?.id || user?.user_id

    try {
      const { connected, account } = await unipileService.checkLinkedInStatus(userId)

      setIsConnected(connected)

      if (connected && account) {
        console.log('📊 Setting profile data in widget:', account);

        // Fetch last researched date from research_cache
        // Use the linkedin_url from user profile to query research_cache
        let lastResearchedAt: string | undefined = undefined
        try {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('linkedin_url')
            .eq('user_id', userId)
            .single()

          console.log('🔍 User profile linkedin_url:', userProfile?.linkedin_url)

          if (userProfile?.linkedin_url) {
            // Query for personal_user type specifically (user's own profile)
            const { data: researchCacheList, error: cacheError } = await supabase
              .from('research_cache')
              .select('last_researched_at, profile_type, profile_url')
              .eq('profile_url', userProfile.linkedin_url)
              .eq('profile_type', 'personal_user')
              .order('last_researched_at', { ascending: false })
              .limit(1)

            console.log('📊 Research cache query result:', { researchCacheList, cacheError })

            if (cacheError) {
              console.log('⚠️ Error querying research cache:', cacheError.message)
            } else if (researchCacheList && researchCacheList.length > 0) {
              lastResearchedAt = researchCacheList[0].last_researched_at
              console.log('📅 Found research date:', lastResearchedAt)
            } else {
              console.log('⚠️ No research cache entries found for this URL')
            }
          } else {
            console.log('⚠️ No linkedin_url in user profile')
          }
        } catch (err) {
          console.log('❌ Error fetching research cache:', err)
        }

        setProfile({
          id: account.id,
          username: account.username,
          connected: true,
          profileUrl: account.metadata?.profile_url,
          status: account.status,
          metadata: account.metadata,
          lastResearchedAt
        })
      } else {
        setProfile(null)
      }
    } catch (error) {
      console.error('Failed to check LinkedIn status:', error)
      setIsConnected(false)
      setProfile(null)
    }
  }

  const handleConnect = async () => {
    if (!user) return

    setIsConnecting(true)
    const userId = user?.id || user?.user_id

    // IMPORTANT: Open popup BEFORE async call to avoid popup blockers
    // We'll set a loading page first, then redirect once we get the auth URL
    const authWindow = window.open(
      'about:blank',
      'unipile-auth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    )

    // Add loading message to the popup
    if (authWindow) {
      authWindow.document.write(`
        <html>
          <head>
            <title>Connecting to LinkedIn...</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #0a0f1b 0%, #1a1f2e 100%);
                color: white;
              }
              .loader {
                text-align: center;
              }
              .spinner {
                border: 4px solid rgba(251, 174, 28, 0.3);
                border-top: 4px solid #FBAE1C;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div class="loader">
              <div class="spinner"></div>
              <h2>Connecting to LinkedIn</h2>
              <p>Please wait...</p>
            </div>
          </body>
        </html>
      `)
    }

    try {
      const result = await unipileService.generateAuthLink(userId, 'create')

      if (result.success && result.data) {
        // Redirect the popup to the actual auth URL
        if (authWindow && !authWindow.closed) {
          authWindow.location.href = result.data.url
        } else {
          throw new Error('Popup was blocked. Please allow popups for this site.')
        }

        // Listen for auth completion via postMessage
        const handleMessage = (event: MessageEvent) => {
          // Security check - only accept messages from Unipile domain
          if (!event.origin.includes('unipile.com')) return

          if (event.data.type === 'UNIPILE_AUTH_SUCCESS') {
            // Close the auth window
            authWindow?.close()

            // Clean up listeners
            window.removeEventListener('message', handleMessage)
            clearInterval(checkClosed)

            setIsConnecting(false)
            toast.success('LinkedIn connected successfully!')

            // Refresh connection status
            setTimeout(() => {
              checkLinkedInStatus()
            }, 1000)
          }
        }

        // Add message listener
        window.addEventListener('message', handleMessage)

        // Fallback: Listen for manual window closure
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', handleMessage)
            setIsConnecting(false)

            // Refresh connection status after auth window closes
            setTimeout(() => {
              checkLinkedInStatus()
            }, 1000)
          }
        }, 1000)

        toast.info('Complete LinkedIn connection in the popup window')
      } else {
        // Close the popup if auth link generation failed
        authWindow?.close()
        throw new Error(result.error || 'Failed to generate auth link')
      }
    } catch (error: any) {
      console.error('LinkedIn connection error:', error)
      toast.error(`Failed to connect: ${error.message}`)
      // Close popup on error
      authWindow?.close()
      setIsConnecting(false)
    }
  }

  const handleManage = () => {
    setShowManageModal(true)
  }

  const handleDisconnect = async () => {
    if (!user || !profile) return

    const userId = user?.id || user?.user_id
    setIsDisconnecting(true)

    try {
      const success = await unipileService.disconnectLinkedIn(userId)
      if (success) {
        toast.success('LinkedIn disconnected successfully')
        setIsConnected(false)
        setProfile(null)
        setShowDisconnectConfirm(false)
        setShowManageModal(false)

        // Refresh the page to update all widgets
        setTimeout(() => {
          window.location.reload()
        }, 500) // Small delay to let toast show
      } else {
        toast.error('Failed to disconnect LinkedIn')
        setIsDisconnecting(false)
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      toast.error('Failed to disconnect LinkedIn')
      setIsDisconnecting(false)
    }
  }

  const handleViewProfile = () => {
    if (profile?.metadata?.profile_url || profile?.profileUrl) {
      const url = profile.metadata?.profile_url || profile.profileUrl
      window.open(url, '_blank')
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getNextResearchDate = (lastResearchedAt: string) => {
    const lastDate = new Date(lastResearchedAt)
    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate() + 7)
    return nextDate
  }

  const getDaysUntilNextResearch = (lastResearchedAt: string) => {
    const nextDate = getNextResearchDate(lastResearchedAt)
    const today = new Date()
    const diffTime = nextDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Disconnected State
  if (forceEmpty || !isConnected) {
    return (
      <div className={`relative shadow-2xl rounded-2xl p-4 overflow-hidden border border-white/10 text-white ${isOnboardingHighlight ? 'onboarding-highlight' : ''} ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
            <h3 className="text-sm font-semibold text-white/90">LinkedIn</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-red-400">Disconnected</span>
          </div>
        </div>

        {/* Status Message */}
        <p className="text-xs text-gray-400 mb-3">
          Connect LinkedIn to enable automated messaging
        </p>

        {/* Connect Button */}
        <div className="relative">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium py-2 px-4 rounded-lg hover:shadow-lg transition-all duration-200 text-xs flex items-center justify-center space-x-2 disabled:opacity-50">
            <Link2 className="w-4 h-4" />
            <span>{isConnecting ? 'Connecting...' : 'Connect LinkedIn'}</span>
          </button>
          {/* Onboarding Arrow */}
          {isOnboardingHighlight && (
            <div className="absolute -right-16 top-1/2 -translate-y-1/2">
              <OnboardingArrow direction="left" />
            </div>
          )}
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-xl"></div>
      </div>
    )
  }

  // Management Modal Component (rendered via portal)
  const renderModal = () => {
    if (!showManageModal) return null

    return createPortal(
      <AnimatePresence>
        {showManageModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              backgroundColor: 'rgba(10, 14, 27, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowManageModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glass Effect Modal */}
              <div className="rounded-3xl border border-white/10 text-white overflow-hidden shadow-2xl shadow-black/50"
                   style={{
                     background: 'linear-gradient(135deg, rgba(10, 14, 27, 0.95) 0%, rgba(26, 31, 54, 0.95) 100%)',
                     backdropFilter: 'blur(10px)',
                     WebkitBackdropFilter: 'blur(10px)'
                   }}>
                {/* Modal Header */}
                <div className="p-6 pb-4 border-b border-white/10"
                     style={{
                       background: 'linear-gradient(180deg, rgba(10, 14, 27, 0.98) 0%, rgba(26, 31, 54, 0.95) 100%)'
                     }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                      <div>
                        <h3 className="text-xl font-bold text-white">LinkedIn Account</h3>
                        <p className="text-sm text-gray-400">Manage your connection</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowManageModal(false)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-6">

              {/* Profile Info */}
              {profile && (
                <div className="mb-6 p-4 rounded-lg border border-gray-700" style={{ backgroundColor: 'rgba(17, 24, 39, 0.5)' }}>
                  <div className="flex items-start gap-4 mb-4">
                    <img
                      src={
                        profile.metadata?.profile_picture_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=0077B5&color=fff&size=64&rounded=true`
                      }
                      alt={profile.username}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=0077B5&color=fff&size=64&rounded=true`;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold text-white mb-1">{profile.username}</p>
                      {profile.metadata?.occupation && (
                        <p className="text-sm text-gray-400 mb-2 leading-relaxed">
                          {profile.metadata.occupation}
                        </p>
                      )}
                      {profile.metadata?.organization && (
                        <p className="text-sm text-gray-500 mb-1">
                          at {profile.metadata.organization}
                        </p>
                      )}
                      {profile.metadata?.location && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <span>📍</span> {profile.metadata.location}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-700/50">
                    <div className="w-2 h-2 bg-green-500 rounded-full"
                         style={{
                           animation: 'pulse-green 2s ease-in-out infinite'
                         }}></div>
                    <span className="text-sm text-green-400 font-medium">Connected & Active</span>
                  </div>
                </div>
              )}

              {/* Research Schedule Info */}
              {profile?.lastResearchedAt && (
                <div className="mb-6 p-4 rounded-lg border border-blue-700/30 bg-blue-900/10">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-blue-300 mb-2">Research Schedule</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Last Researched:</span>
                          <span className="text-white font-medium">{formatDate(profile.lastResearchedAt)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Next Research:</span>
                          <span className="text-white font-medium">{formatDate(getNextResearchDate(profile.lastResearchedAt).toISOString())}</span>
                        </div>
                        <div className="pt-2 border-t border-blue-700/30">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <span className="text-blue-300 text-xs font-medium">
                              {getDaysUntilNextResearch(profile.lastResearchedAt) > 0
                                ? `${getDaysUntilNextResearch(profile.lastResearchedAt)} days until next research`
                                : 'Will be refreshed on next message generation'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* View Profile Button */}
                {(profile?.metadata?.profile_url || profile?.profileUrl) && (
                  <button
                    onClick={handleViewProfile}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-800 text-white transition-all duration-200 hover:shadow-lg"
                  >
                    <Eye className="w-5 h-5" />
                    <span className="font-medium text-base">View LinkedIn Profile</span>
                  </button>
                )}

                {/* Disconnect Button */}
                {!showDisconnectConfirm ? (
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-red-600/50 hover:border-red-500 bg-red-900/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-all duration-200 hover:shadow-lg"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium text-base">Disconnect Account</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-lg border border-red-600/50 bg-red-900/20">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-base font-semibold text-red-300 mb-2">Confirm Disconnect</p>
                        <p className="text-sm text-gray-400 leading-relaxed">
                          This will remove your LinkedIn connection and delete your account from Unipile. You'll need to reconnect to use LinkedIn features again.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDisconnectConfirm(false)}
                        disabled={isDisconnecting}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-600 bg-gray-800/50 hover:bg-gray-800 text-gray-300 hover:text-white transition-all duration-200 text-sm font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-all duration-200 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isDisconnecting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Disconnecting...</span>
                          </>
                        ) : (
                          'Confirm'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                  {/* Close Button */}
                  <button
                    onClick={() => setShowManageModal(false)}
                    disabled={isDisconnecting}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-gray-800/30 hover:bg-gray-800/50 text-gray-300 hover:text-white transition-all duration-200 font-medium text-sm disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>,
      document.body
    )
  }

  // Connected State
  return (
    <>
      <div className={`relative shadow-2xl rounded-2xl p-4 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
            <h3 className="text-sm font-semibold text-white/90">LinkedIn</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"
                 style={{
                   animation: 'pulse-green 2s ease-in-out infinite',
                   boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.4)'
                 }}></div>
            <span className="text-xs text-green-400">Connected</span>
          </div>
        </div>

        {/* Connected Account */}
        {profile && (
          <div className="flex items-start gap-3 mb-3">
            <img
              src={
                profile.metadata?.profile_picture_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=0077B5&color=fff&size=32&rounded=true`
              }
              alt="LinkedIn Profile"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                // Fallback to generated avatar if profile picture fails to load
                const target = e.target as HTMLImageElement;
                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=0077B5&color=fff&size=32&rounded=true`;
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 mb-1">{profile.username}</p>
              {profile.metadata?.occupation && (
                <p className="text-xs text-gray-400 leading-tight mb-1 break-words">
                  {profile.metadata.occupation}
                </p>
              )}
              {profile.metadata?.organization && (
                <p className="text-xs text-gray-500">
                  at {profile.metadata.organization}
                </p>
              )}
            </div>
            {(profile.metadata?.profile_url || profile.profileUrl) && (
              <button
                onClick={() => {
                  const url = profile.metadata?.profile_url || profile.profileUrl;
                  console.log('🔗 Opening LinkedIn URL:', url);
                  window.open(url, '_blank');
                }}
                className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200"
                title="View LinkedIn Profile"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Refresh Note */}
        <div className="mb-3 px-2 py-1 bg-black/20 backdrop-blur-sm rounded-lg border border-white/5">
          <p className="text-xs text-gray-400">
            <span className="text-[#FBAE1C]">ℹ</span> {profile?.lastResearchedAt
              ? getDaysUntilNextResearch(profile.lastResearchedAt) > 0
                ? `Next research in ${getDaysUntilNextResearch(profile.lastResearchedAt)} days`
                : 'Updates on next message generation'
              : 'Profile data refreshed weekly'}
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleManage}
          className="w-full bg-white/10 hover:bg-white/15 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 text-xs flex items-center justify-center space-x-2">
          <Settings className="w-4 h-4" />
          <span>Manage</span>
        </button>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-xl"></div>
      </div>

      {/* Render modal via portal */}
      {renderModal()}
    </>
  )
}
