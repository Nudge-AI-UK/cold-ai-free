import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Save, Lock, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { FREE_TIER_LIMITS } from '@/lib/constants'
import type { KnowledgeEntry } from '@/types'

interface KnowledgeWidgetProps {
  isActive: boolean
  onActivate: () => void
  className?: string
}

export function KnowledgeWidget({ isActive, onActivate, className }: KnowledgeWidgetProps) {
  const { user } = useAuth()
  const [entry, setEntry] = useState<Partial<KnowledgeEntry>>({
    title: '',
    content: '',
    category: 'product',
  })
  const [loading, setLoading] = useState(false)
  const [hasEntry, setHasEntry] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (user) {
      fetchKnowledge()
    }
  }, [user])

  const fetchKnowledge = async () => {
    if (!user) return
    
    const { data } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('created_by', user.id)
      .limit(1)
      .single()

    if (data) {
      setEntry(data)
      setHasEntry(true)
    }
  }

  const handleSave = async () => {
    if (!user || !entry.title || !entry.content) {
      toast.error('Title and content are required')
      return
    }
    
    setLoading(true)
    
    if (hasEntry && entry.id) {
      // Update existing entry
      const { error } = await supabase
        .from('knowledge_base')
        .update({
          title: entry.title,
          content: entry.content,
          category: entry.category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id)

      if (error) {
        toast.error('Failed to update knowledge entry')
      } else {
        toast.success('Knowledge entry updated')
      }
    } else {
      // Create new entry
      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          user_id: user.id,
          title: entry.title,
          content: entry.content,
          category: entry.category || 'product',
        })
        .select()
        .single()

      if (error) {
        toast.error('Failed to create knowledge entry')
      } else if (data) {
        setEntry(data)
        setHasEntry(true)
        toast.success('Knowledge entry created')
      }
    }
    
    setLoading(false)
  }

  // Empty State - New landscape design
  if (!hasEntry && !isCreating) {
    return (
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-gray-700/50 text-gray-400 border border-gray-600/50 px-3 py-1 rounded-full text-xs">
            Not Created
          </div>
        </div>

        {/* Account Info */}
        <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
          Free Account: 1 Product/Service Limit
        </div>

        <div className="flex gap-8">
          {/* Left Side - Icon and Main Content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-6 mb-4">
              {/* Floating Icon */}
              <div className="relative inline-block" style={{ animation: 'float 3s ease-in-out infinite' }}>
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
                  <span className="text-4xl">📦</span>
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                  1
                </div>
              </div>
              
              {/* Title and Description */}
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2"
                    style={{
                      background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      animation: 'shimmer 3s linear infinite'
                    }}>
                  Add Your Product/Service
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Create your first product entry to maximise AI-powered message personalisation
                </p>
              </div>
            </div>

            {/* Benefits Grid - Horizontal */}
            <div className="flex gap-3 mb-4">
              <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                   style={{
                     background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                     backdropFilter: 'blur(10px)'
                   }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <p className="text-xs text-gray-300">10x Response</p>
                </div>
              </div>
              <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                   style={{
                     background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                     backdropFilter: 'blur(10px)'
                   }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <p className="text-xs text-gray-300">AI-Powered</p>
                </div>
              </div>
              <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                   style={{
                     background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                     backdropFilter: 'blur(10px)'
                   }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚀</span>
                  <p className="text-xs text-gray-300">2min Setup</p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group">
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span>Create Your Product/Service Entry</span>
            </button>
          </div>

          {/* Right Side - What You'll Define */}
          <div className="w-80">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">What You'll Define</h4>
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FBAE1C] mt-1.5"></div>
                  <span className="text-xs text-gray-300">The pain points your product/service addresses</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FC9109] mt-1.5"></div>
                  <span className="text-xs text-gray-300">The key selling benefits</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#DD6800] mt-1.5"></div>
                  <span className="text-xs text-gray-300">Who you might be selling to</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                Provide a product URL for AI-powered analysis
              </p>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Create/Edit Form State
  if (hasEntry || isCreating) {
    return (
      <Card className="lg:col-span-2 widget-fade-in">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>Product or service information for context</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                <Lock className="h-3 w-3 mr-1" />
                Free: 1 entry
              </Badge>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kb_title">Title *</Label>
            <Input
              id="kb_title"
              value={entry.title || ''}
              onChange={(e) => setEntry({ ...entry, title: e.target.value })}
              placeholder="e.g. Our Main Product"
              maxLength={100}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="kb_content">Content *</Label>
            <Textarea
              id="kb_content"
              value={entry.content || ''}
              onChange={(e) => setEntry({ ...entry, content: e.target.value })}
              placeholder="Describe your product or service in detail. Include key features, benefits, and unique selling points..."
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {entry.content?.length || 0} characters
            </p>
          </div>
          
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">💡 Tip</p>
            <p className="text-xs text-blue-700 mt-1">
              Include specific details about your product's benefits, pricing, and what makes it unique. 
              This information will be used to personalise your outreach messages.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // This shouldn't be reached but kept for safety
  return null
}
