import { useState, useEffect } from 'react'
import { Plus, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface ProspectWidgetProps {
  forceEmpty?: boolean
  className?: string
}

interface Prospect {
  id: string
  name: string
  job_title: string
  company: string
  status: 'sent' | 'viewed' | 'replied'
  linkedin_url?: string
  created_at: string
}

export function ProspectWidget({ forceEmpty, className }: ProspectWidgetProps) {
  const { user } = useAuth()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [stats, setStats] = useState({ sent: 0, replied: 0, responseRate: 0 })

  useEffect(() => {
    if (user && !forceEmpty) {
      fetchProspects()
    }
  }, [user, forceEmpty])

  const fetchProspects = async () => {
    if (!user) return
    
    // Mock data since prospects table doesn't exist in schema
    // In production, this would fetch from actual prospects table
    const mockProspects: Prospect[] = [
      {
        id: '1',
        name: 'Sarah Johnson',
        job_title: 'VP Sales',
        company: 'TechCorp',
        status: 'replied',
        linkedin_url: 'https://linkedin.com/in/sarahjohnson',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        name: 'Michael Chen',
        job_title: 'Director',
        company: 'StartupX',
        status: 'viewed',
        linkedin_url: 'https://linkedin.com/in/michaelchen',
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '3',
        name: 'Emma Williams',
        job_title: 'Sales Mgr',
        company: 'Global Inc',
        status: 'sent',
        linkedin_url: 'https://linkedin.com/in/emmawilliams',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '4',
        name: 'James Taylor',
        job_title: 'CEO',
        company: 'Innovation Labs',
        status: 'replied',
        linkedin_url: 'https://linkedin.com/in/jamestaylor',
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      }
    ]
    
    setProspects(mockProspects)
    
    // Calculate stats
    const sent = mockProspects.length
    const replied = mockProspects.filter(p => p.status === 'replied').length
    const responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0
    
    setStats({ sent, replied, responseRate })
  }

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'replied':
        return { dot: 'bg-green-500', text: 'text-green-400' }
      case 'viewed':
        return { dot: 'bg-[#FBAE1C]', text: 'text-[#FBAE1C]' }
      case 'sent':
      default:
        return { dot: 'bg-blue-500', text: 'text-blue-400' }
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('')
  }

  const getAvatarColor = (index: number) => {
    const colors = ['FBAE1C', 'FC9109', 'DD6800', 'FBAE1C']
    return colors[index % colors.length]
  }

  // Empty State
  if (forceEmpty || prospects.length === 0) {
    return (
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Account Info */}
        <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
          Free Account: 25 Messages/Month
        </div>

        {/* Central Icon and Message */}
        <div className="text-center py-8">
          <div className="relative inline-block mb-6" style={{ animation: 'float 3s ease-in-out infinite' }}>
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
              <span className="text-5xl">👥</span>
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
              0
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2"
              style={{
                background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'shimmer 3s linear infinite'
              }}>
            No Prospects Yet
          </h2>
          
          <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
            Start generating personalised messages to build your prospect pipeline
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl p-3 text-center border border-white/5"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                 backdropFilter: 'blur(10px)'
               }}>
            <div className="text-2xl mb-2">📊</div>
            <p className="text-xs text-gray-300">Track Opens</p>
          </div>
          <div className="rounded-xl p-3 text-center border border-white/5"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                 backdropFilter: 'blur(10px)'
               }}>
            <div className="text-2xl mb-2">💬</div>
            <p className="text-xs text-gray-300">Messages</p>
          </div>
          <div className="rounded-xl p-3 text-center border border-white/5"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                 backdropFilter: 'blur(10px)'
               }}>
            <div className="text-2xl mb-2">📈</div>
            <p className="text-xs text-gray-300">Response Rate</p>
          </div>
        </div>

        {/* What You'll See Section */}
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/5">
          <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">What You'll Track</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FBAE1C]"></div>
              <span className="text-xs text-gray-300">Prospect profiles & company details</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FC9109]"></div>
              <span className="text-xs text-gray-300">Message status & engagement</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#DD6800]"></div>
              <span className="text-xs text-gray-300">Response rates & follow-ups</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-4 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group">
          <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Generate Your First Message</span>
        </button>

        {/* Helper Text */}
        <p className="text-center text-xs text-gray-500 mt-4">
          All messages are tracked automatically
        </p>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Active State with Prospects
  return (
    <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
         style={{
           background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
           backdropFilter: 'blur(10px)',
           WebkitBackdropFilter: 'blur(10px)'
         }}>
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-3xl">👥</div>
          <div>
            <h2 className="text-xl font-bold"
                style={{
                  background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'shimmer 3s linear infinite'
                }}>
              Prospects
            </h2>
            <p className="text-xs text-gray-400">{prospects.length} active conversations</p>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-3 mb-6 border border-white/5">
        <div className="flex justify-around text-center">
          <div>
            <div className="text-lg font-bold">{stats.sent}</div>
            <div className="text-xs text-gray-400">Sent</div>
          </div>
          <div className="w-px bg-white/10"></div>
          <div>
            <div className="text-lg font-bold text-green-400">{stats.replied}</div>
            <div className="text-xs text-gray-400">Replied</div>
          </div>
          <div className="w-px bg-white/10"></div>
          <div>
            <div className="text-lg font-bold text-[#FBAE1C]">{stats.responseRate}%</div>
            <div className="text-xs text-gray-400">Response</div>
          </div>
        </div>
      </div>

      {/* Prospects List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {prospects.map((prospect, index) => {
          const statusColors = getStatusColor(prospect.status)
          return (
            <div key={prospect.id} 
                 className="rounded-xl border border-white/5 p-3 hover:translate-x-1 transition-all"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <img 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(prospect.name)}&background=${getAvatarColor(index)}&color=fff&size=40&rounded=true`}
                    alt={prospect.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <h3 className="text-sm font-semibold">{prospect.name}</h3>
                    <p className="text-xs text-gray-400">{prospect.job_title} • {prospect.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 ${statusColors.dot} rounded-full`}></div>
                  <span className={`text-xs ${statusColors.text} capitalize`}>{prospect.status}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{getTimeSince(prospect.created_at)}</span>
                <button 
                  onClick={() => prospect.linkedin_url && window.open(prospect.linkedin_url, '_blank')}
                  className="text-[#FBAE1C] text-xs hover:text-white transition-colors">
                  View →
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Action Button */}
      <button className="w-full mt-6 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2">
        <Plus className="w-5 h-5" />
        <span>Add New Prospect</span>
      </button>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
    </div>
  )
}
