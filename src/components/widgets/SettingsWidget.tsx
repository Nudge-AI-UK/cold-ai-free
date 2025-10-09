import { useState, useEffect, useRef } from 'react'
import { User, Building2, MessageCircle, Edit2, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useModalFlow } from '@/components/modals/ModalFlowManager'

interface SettingsWidgetProps {
  forceEmpty?: boolean
  className?: string
}

interface SettingsStatus {
  profile: boolean
  company: boolean
  communication: boolean
}

export function SettingsWidget({ forceEmpty, className }: SettingsWidgetProps) {
  const { user } = useAuth()
  const { openModal } = useModalFlow()
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus>({
    profile: false,
    company: false,
    communication: false
  })
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false)
  const hasAutoOpened = useRef(false)

  const configuredCount = Object.values(settingsStatus).filter(Boolean).length
  const allConfigured = configuredCount === 3

  useEffect(() => {
    console.log('SettingsWidget useEffect:', { user: !!user, forceEmpty, shouldCheck: user && !forceEmpty })
    if (user && !forceEmpty) {
      checkSettingsStatus()
    }
  }, [user, forceEmpty])

  // Auto-open profile modal for new users with no profile data
  useEffect(() => {
    if (!forceEmpty && user && hasCheckedStatus && !settingsStatus.profile && !hasAutoOpened.current) {
      hasAutoOpened.current = true
      openModal('profile-personal', {
        flowName: 'main',
        mode: 'add'
      })
    }
  }, [settingsStatus.profile, user, forceEmpty, openModal, hasCheckedStatus])

  const checkSettingsStatus = async () => {
    if (!user) return

    const userId = user?.id || user?.user_id
    console.log('Checking settings for user ID:', userId)

    // Check user profile
    const { data: profileResults, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
    const userProfile = profileResults?.[0]

    // Check business profile (for solo users)
    const { data: companyResults, error: companyError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
    const companyProfile = companyResults?.[0]

    // Check communication preferences
    const { data: commResults, error: commError } = await supabase
      .from('communication_preferences')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
    const commPrefs = commResults?.[0]

    console.log('Database check results:', {
      profile: { exists: !!userProfile, error: profileError?.message, data: userProfile },
      company: { exists: !!companyProfile, error: companyError?.message, data: companyProfile },
      communication: { exists: !!commPrefs, error: commError?.message, data: commPrefs }
    })

    const newStatus = {
      profile: !!userProfile,
      company: !!companyProfile,
      communication: !!commPrefs
    }

    console.log('Setting new status:', newStatus)
    setSettingsStatus(newStatus)
    setHasCheckedStatus(true)
  }

  const handleButtonClick = (type: 'profile' | 'company' | 'communication') => {
    const modalMapping = {
      profile: 'profile-personal',
      company: 'profile-company',
      communication: 'profile-communication'
    }

    openModal(modalMapping[type], {
      flowName: 'main',
      mode: settingsStatus[type] ? 'edit' : 'add'
    })
  }


  const handleEditSettings = () => {
    window.location.href = '/profile'
  }

  // Empty State
  if (forceEmpty || !allConfigured) {
    return (
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-gray-700/50 text-gray-400 border border-gray-600/50 px-3 py-1 rounded-full text-xs flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            <span>{configuredCount} of 3 Configured</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex items-center gap-6 mb-8">
          {/* Floating Icon */}
          <div className="relative inline-block" style={{ animation: 'float 3s ease-in-out infinite' }}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
              <span className="text-4xl">⚙️</span>
            </div>
            <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
              3
            </div>
          </div>
          
          {/* Title and Subtitle */}
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
              Configure Settings
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Set up your profile to unlock AI-powered message personalisation
            </p>
          </div>
        </div>

        {/* Power Buttons Grid */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          {/* Profile Button */}
          <div className="text-center">
            <button 
              onClick={() => handleButtonClick('profile')}
              className="w-32 h-32 mx-auto rounded-full border-2 border-gray-700/50 flex items-center justify-center mb-4 group relative hover:transform hover:-translate-y-2 transition-all duration-200"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.2))',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5), inset 0 -2px 4px rgba(255, 255, 255, 0.05), 0 0 0 2px rgba(255, 255, 255, 0.05), 0 4px 8px rgba(0, 0, 0, 0.3)'
              }}>
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-gray-600/50 rounded-full shadow-inner"></div>
              <User className={`w-12 h-12 ${settingsStatus.profile ? 'text-green-400' : 'text-gray-500/50'}`} />
            </button>
            <div className="rounded-lg px-3 py-2 inline-block border border-white/5"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                   backdropFilter: 'blur(5px)'
                 }}>
              <h3 className="text-sm font-semibold text-white/80 mb-1">Profile</h3>
              <p className="text-xs text-gray-500">Personal details</p>
            </div>
          </div>

          {/* Company Info Button */}
          <div className="text-center">
            <button 
              onClick={() => handleButtonClick('company')}
              className="w-32 h-32 mx-auto rounded-full border-2 border-gray-700/50 flex items-center justify-center mb-4 group relative hover:transform hover:-translate-y-2 transition-all duration-200"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.2))',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5), inset 0 -2px 4px rgba(255, 255, 255, 0.05), 0 0 0 2px rgba(255, 255, 255, 0.05), 0 4px 8px rgba(0, 0, 0, 0.3)'
              }}>
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-gray-600/50 rounded-full shadow-inner"></div>
              <Building2 className={`w-12 h-12 ${settingsStatus.company ? 'text-green-400' : 'text-gray-500/50'}`} />
            </button>
            <div className="rounded-lg px-3 py-2 inline-block border border-white/5"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                   backdropFilter: 'blur(5px)'
                 }}>
              <h3 className="text-sm font-semibold text-white/80 mb-1">Company Info</h3>
              <p className="text-xs text-gray-500">Business details</p>
            </div>
          </div>

          {/* Communication Button */}
          <div className="text-center">
            <button 
              onClick={() => handleButtonClick('communication')}
              className="w-32 h-32 mx-auto rounded-full border-2 border-gray-700/50 flex items-center justify-center mb-4 group relative hover:transform hover:-translate-y-2 transition-all duration-200"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.2))',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5), inset 0 -2px 4px rgba(255, 255, 255, 0.05), 0 0 0 2px rgba(255, 255, 255, 0.05), 0 4px 8px rgba(0, 0, 0, 0.3)'
              }}>
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-gray-600/50 rounded-full shadow-inner"></div>
              <MessageCircle className={`w-12 h-12 ${settingsStatus.communication ? 'text-green-400' : 'text-gray-500/50'}`} />
            </button>
            <div className="rounded-lg px-3 py-2 inline-block border border-white/5"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                   backdropFilter: 'blur(5px)'
                 }}>
              <h3 className="text-sm font-semibold text-white/80 mb-1">Communication</h3>
              <p className="text-xs text-gray-500">Message preferences</p>
            </div>
          </div>
        </div>

        {/* Bottom Info Bar */}
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1">Why configure settings?</p>
              <p className="text-xs text-gray-300">AI uses your profile data to craft messages that sound like you and resonate with your ideal customers</p>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Active State - All Configured
  return (
    <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
         style={{
           background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
           backdropFilter: 'blur(10px)',
           WebkitBackdropFilter: 'blur(10px)'
         }}>
      
      {/* Status Badge - Active/Green */}
      <div className="absolute top-4 right-4 z-30">
        <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
          <span>3 of 3 Configured</span>
        </div>
      </div>

      {/* Header Section */}
      <div className="flex items-center gap-6 mb-8">
        {/* Settings Icon (static, no circle) */}
        <div className="text-5xl opacity-90">
          ⚙️
        </div>
        
        {/* Title and Subtitle */}
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
            Settings
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Your profile is complete and powering AI personalisation
          </p>
        </div>
      </div>

      {/* Power Buttons Grid - All Active */}
      <div className="grid grid-cols-3 gap-8 mb-8">
        {/* Profile Button - Active */}
        <div className="text-center">
          <button 
            onClick={() => handleButtonClick('profile')}
            className="w-32 h-32 mx-auto rounded-full border-2 border-[#FBAE1C]/30 flex items-center justify-center mb-4 group relative hover:scale-105 transition-all duration-200"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(251, 174, 28, 0.2), rgba(252, 145, 9, 0.1))',
              boxShadow: '0 0 40px rgba(251, 174, 28, 0.4)',
              animation: 'pulse-glow 3s ease-in-out infinite'
            }}>
            <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-green-500 rounded-full"
                 style={{ boxShadow: '0 0 10px rgba(16, 185, 129, 0.8)' }}></div>
            <User className="w-12 h-12 text-green-400 drop-shadow-lg" />
            <div className="absolute bottom-4 right-4">
              <Check className="w-5 h-5 text-green-400 drop-shadow" />
            </div>
          </button>
          <div className="rounded-lg px-3 py-2 inline-block border border-[#FBAE1C]/20"
               style={{
                 background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.08) 0%, rgba(252, 145, 9, 0.04) 100%)',
                 backdropFilter: 'blur(5px)'
               }}>
            <h3 className="text-sm font-semibold text-white mb-1">Profile</h3>
            <p className="text-xs text-green-400">Complete</p>
          </div>
        </div>

        {/* Company Info Button - Active */}
        <div className="text-center">
          <button 
            onClick={() => handleButtonClick('company')}
            className="w-32 h-32 mx-auto rounded-full border-2 border-[#FBAE1C]/30 flex items-center justify-center mb-4 group relative hover:scale-105 transition-all duration-200"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(251, 174, 28, 0.2), rgba(252, 145, 9, 0.1))',
              boxShadow: '0 0 40px rgba(251, 174, 28, 0.4)',
              animation: 'pulse-glow 3s ease-in-out infinite'
            }}>
            <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-green-500 rounded-full"
                 style={{ boxShadow: '0 0 10px rgba(16, 185, 129, 0.8)' }}></div>
            <Building2 className="w-12 h-12 text-green-400 drop-shadow-lg" />
            <div className="absolute bottom-4 right-4">
              <Check className="w-5 h-5 text-green-400 drop-shadow" />
            </div>
          </button>
          <div className="rounded-lg px-3 py-2 inline-block border border-[#FBAE1C]/20"
               style={{
                 background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.08) 0%, rgba(252, 145, 9, 0.04) 100%)',
                 backdropFilter: 'blur(5px)'
               }}>
            <h3 className="text-sm font-semibold text-white mb-1">Company Info</h3>
            <p className="text-xs text-green-400">Complete</p>
          </div>
        </div>

        {/* Communication Button - Active */}
        <div className="text-center">
          <button 
            onClick={() => handleButtonClick('communication')}
            className="w-32 h-32 mx-auto rounded-full border-2 border-[#FBAE1C]/30 flex items-center justify-center mb-4 group relative hover:scale-105 transition-all duration-200"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(251, 174, 28, 0.2), rgba(252, 145, 9, 0.1))',
              boxShadow: '0 0 40px rgba(251, 174, 28, 0.4)',
              animation: 'pulse-glow 3s ease-in-out infinite'
            }}>
            <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-green-500 rounded-full"
                 style={{ boxShadow: '0 0 10px rgba(16, 185, 129, 0.8)' }}></div>
            <MessageCircle className="w-12 h-12 text-green-400 drop-shadow-lg" />
            <div className="absolute bottom-4 right-4">
              <Check className="w-5 h-5 text-green-400 drop-shadow" />
            </div>
          </button>
          <div className="rounded-lg px-3 py-2 inline-block border border-[#FBAE1C]/20"
               style={{
                 background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.08) 0%, rgba(252, 145, 9, 0.04) 100%)',
                 backdropFilter: 'blur(5px)'
               }}>
            <h3 className="text-sm font-semibold text-white mb-1">Communication</h3>
            <p className="text-xs text-green-400">Complete</p>
          </div>
        </div>
      </div>

      {/* Bottom Success Bar */}
      <div className="bg-gradient-to-r from-[#FBAE1C]/10 to-[#FC9109]/10 backdrop-blur-sm rounded-2xl p-4 border border-[#FBAE1C]/20">
        <div className="flex items-center justify-between">
          <div className="flex-1 flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <p className="text-xs font-medium text-[#FBAE1C] mb-1">Cold AI Ready</p>
              <p className="text-xs text-gray-300">Your settings are optimised for maximum personalisation and response rates</p>
            </div>
          </div>
          <button 
            onClick={handleEditSettings}
            className="ml-4 bg-white/10 hover:bg-white/15 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-xs flex items-center space-x-2 group">
            <span>Edit Settings</span>
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
    </div>
  )
}
