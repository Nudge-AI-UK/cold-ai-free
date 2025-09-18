import { useState, useEffect } from 'react'
import { Zap, Send, Copy, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface MessageWidgetProps {
  forceEmpty?: boolean
  className?: string
}

export function MessageWidget({ forceEmpty, className }: MessageWidgetProps) {
  const { user } = useAuth()
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  const [setupStatus, setSetupStatus] = useState({
    settings: { personal: false, company: false, communication: false },
    product: false,
    icp: false
  })

  useEffect(() => {
    if (user && !forceEmpty) {
      checkSetupStatus()
    }
  }, [user, forceEmpty])

  const checkSetupStatus = async () => {
    if (!user) return

    // Check user profiles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.user_id)
      .single()

    // Check business profiles
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.user_id)
      .single()

    // Check communication preferences
    const { data: commPrefs } = await supabase
      .from('communication_preferences')
      .select('*')
      .eq('user_id', user.user_id)
      .single()

    // Check knowledge base
    const { data: knowledgeBase } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('created_by', user.user_id)
      .limit(1)
      .single()

    // Check ICPs
    const { data: icp } = await supabase
      .from('icps')
      .select('*')
      .eq('created_by', user.user_id)
      .limit(1)
      .single()

    const status = {
      settings: {
        personal: !!userProfile,
        company: !!businessProfile,
        communication: !!commPrefs
      },
      product: !!knowledgeBase,
      icp: !!icp
    }

    setSetupStatus(status)
    setSetupComplete(
      status.settings.personal && 
      status.settings.company && 
      status.settings.communication && 
      status.product && 
      status.icp
    )
  }

  const handleGenerate = async () => {
    if (!linkedinUrl) {
      toast.error('Please enter a LinkedIn URL')
      return
    }

    setIsGenerating(true)
    // Simulate generation
    setTimeout(() => {
      setGeneratedMessage(`Hi [Name],

I noticed your experience in B2B sales and thought you'd be interested in how we're helping teams like yours book 3x more meetings with personalised AI-powered outreach.

Our platform has helped similar companies reduce prospecting time by 70% while improving response rates.

Would you be open to a quick chat next week to see if this could help your team?

Best regards,
[Your Name]`)
      setIsGenerating(false)
    }, 2000)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedMessage)
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
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/example" 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-[#FBAE1C]/50 transition-all duration-200"
                />
              </div>
            </div>

            {/* Configuration Options */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">ICP Profile</span>
                  <span className="text-xs font-medium text-[#FBAE1C]">B2B Sales Teams</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Message Type</span>
                  <span className="text-xs font-medium text-[#FBAE1C]">Connection Request</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Product Context</span>
                  <span className="text-xs font-medium text-[#FBAE1C]">Cold AI Pro</span>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group disabled:opacity-50">
              <Zap className={`w-5 h-5 ${isGenerating ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              <span>{isGenerating ? 'Generating...' : 'Generate Message'}</span>
            </button>

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
              <div className="bg-black/30 rounded-xl border border-white/10 p-4 text-sm leading-relaxed min-h-[200px]">
                {generatedMessage ? (
                  <div className="text-gray-300 whitespace-pre-wrap">{generatedMessage}</div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
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
            <div className="flex justify-between text-xs text-gray-500">
              <span>Character count: {generatedMessage.length}/300</span>
              <span>Est. response rate: {generatedMessage ? '15-20%' : '--'}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button 
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-200 text-sm flex items-center justify-center space-x-2 ${
                  generatedMessage 
                    ? 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white hover:shadow-lg' 
                    : 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!generatedMessage}>
                <Send className="w-5 h-5" />
                <span>Send Message</span>
              </button>
              <button 
                onClick={copyToClipboard}
                className={`p-3 rounded-xl border transition-all duration-200 ${
                  generatedMessage 
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300' 
                    : 'bg-gray-700/30 border-gray-700/30 text-gray-600 cursor-not-allowed'
                }`}
                disabled={!generatedMessage}>
                <Copy className="w-5 h-5" />
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
