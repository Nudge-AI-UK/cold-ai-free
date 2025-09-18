import { useState, useEffect } from 'react'
import { Link2, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface LinkedInWidgetProps {
  forceEmpty?: boolean
  className?: string
}

interface LinkedInProfile {
  name: string
  email: string
  connected: boolean
  profileUrl?: string
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

    // Check user profile for LinkedIn connection status
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('linkedin_url, linkedin_connected')
      .eq('user_id', user.user_id)
      .single()

    if (userProfile?.linkedin_connected) {
      setIsConnected(true)
      // Mock profile data - in production this would come from Unipile/LinkedIn API
      setProfile({
        name: 'John Doe',
        email: 'john.doe@company.com',
        connected: true,
        profileUrl: userProfile.linkedin_url || undefined
      })
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    // Simulate connection process
    setTimeout(() => {
      toast.success('LinkedIn integration coming soon!')
      setIsConnecting(false)
    }, 1500)
  }

  const handleManage = () => {
    toast.info('LinkedIn settings will open here')
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
        <div className="flex items-center gap-3 mb-3">
          <img 
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=0077B5&color=fff&size=32&rounded=true`}
            alt="Profile"
            className="w-8 h-8 rounded-full"
          />
          <div className="flex-1">
            <p className="text-xs font-medium text-white/90">{profile.name}</p>
            <p className="text-xs text-gray-500">{profile.email}</p>
          </div>
        </div>
      )}

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
