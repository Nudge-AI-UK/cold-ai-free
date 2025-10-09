import { useState, useEffect } from 'react'
import { Link2, Settings, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { unipileService } from '@/services/unipileService'

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
  const [isConnected, setIsConnected] = useState(false)
  const [profile, setProfile] = useState<LinkedInProfile | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

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
        setProfile({
          id: account.id,
          username: account.username,
          connected: true,
          profileUrl: account.metadata?.profile_url,
          status: account.status,
          metadata: account.metadata
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

    try {
      const result = await unipileService.generateAuthLink(userId, 'create')

      if (result.success && result.data) {
        // Open Unipile hosted auth in new window
        const authWindow = window.open(
          result.data.url,
          'unipile-auth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        )

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
        throw new Error(result.error || 'Failed to generate auth link')
      }
    } catch (error: any) {
      console.error('LinkedIn connection error:', error)
      toast.error(`Failed to connect: ${error.message}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleManage = async () => {
    if (!user || !profile) return

    const userId = user?.id || user?.user_id

    // Show management options
    const action = window.confirm(
      'LinkedIn Account Management\n\n' +
      `Connected as: ${profile.username}\n` +
      `Status: ${profile.status}\n\n` +
      'Click OK to disconnect, Cancel to view profile'
    )

    if (action) {
      // Disconnect LinkedIn
      try {
        const success = await unipileService.disconnectLinkedIn(userId)
        if (success) {
          toast.success('LinkedIn disconnected successfully')
          setIsConnected(false)
          setProfile(null)
        } else {
          toast.error('Failed to disconnect LinkedIn')
        }
      } catch (error) {
        console.error('Disconnect error:', error)
        toast.error('Failed to disconnect LinkedIn')
      }
    } else if (profile.profileUrl) {
      // Open LinkedIn profile
      window.open(profile.profileUrl, '_blank')
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('')
  }

  // Disconnected State
  if (forceEmpty || !isConnected) {
    return (
      <div className={`relative shadow-2xl rounded-2xl p-4 overflow-hidden border border-white/10 text-white ${className}`}
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
        <button 
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium py-2 px-4 rounded-lg hover:shadow-lg transition-all duration-200 text-xs flex items-center justify-center space-x-2 disabled:opacity-50">
          <Link2 className="w-4 h-4" />
          <span>{isConnecting ? 'Connecting...' : 'Connect LinkedIn'}</span>
        </button>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-xl"></div>
      </div>
    )
  }

  // Connected State
  return (
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
          <span className="text-[#FBAE1C]">ℹ</span> Profile data refreshed monthly
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
  )
}
