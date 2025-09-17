import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Copy, Loader2, Send, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { FREE_TIER_LIMITS, MESSAGE_TYPES } from '@/lib/constants'
import type { ICP, Usage } from '@/types'

interface MessageWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function MessageWidget({ isActive, onActivate }: MessageWidgetProps) {
  const { user } = useAuth()
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [messageType, setMessageType] = useState<'linkedin' | 'email' | 'call_script'>('linkedin')
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [icp, setIcp] = useState<ICP | null>(null)
  const [canGenerate, setCanGenerate] = useState(true)

  useEffect(() => {
    if (user) {
      fetchUsage()
      fetchICP()
    }
  }, [user])

  const fetchUsage = async () => {
    if (!user) return
    
    const currentDate = new Date()
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    
    const { data } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .gte('period_start', startOfMonth.toISOString())
      .lte('period_end', endOfMonth.toISOString())
      .single()

    if (data) {
      setUsage(data)
      setCanGenerate(data.messages_remaining > 0)
    }
  }

  const fetchICP = async () => {
    if (!user) return
    
    const { data } = await supabase
      .from('icps')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (data) {
      setIcp(data)
    }
  }

  const handleGenerate = async () => {
    if (!user || !canGenerate) {
      toast.error('You have reached your monthly message limit')
      return
    }

    if (!linkedinUrl && messageType === 'linkedin') {
      toast.error('Please enter a LinkedIn URL')
      return
    }

    if (!icp) {
      toast.error('Please create an ICP first')
      return
    }

    setLoading(true)
    
    try {
      // Simulate message generation (in production, this would call your AI service)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockMessage = messageType === 'email' 
        ? `Subject: Transforming ${icp.industries?.[0] || 'Your Industry'} with Innovation\n\nDear [Name],\n\nI noticed your role as [Job Title] and wanted to reach out about how we're helping companies like yours overcome ${icp.pain_points?.[0] || 'common challenges'}.\n\nOur solution has helped similar organisations achieve ${icp.goals?.[0] || 'their goals'}.\n\nWould you be open to a brief conversation next week?\n\nBest regards,\n[Your Name]`
        : messageType === 'call_script'
        ? `Opening: "Hi [Name], I'm calling from [Company]. I know you're busy, so I'll be brief. We're working with ${icp.industries?.[0] || 'companies in your industry'} to help them ${icp.goals?.[0] || 'achieve their goals'}."\n\nValue Prop: "We've noticed that many ${icp.job_titles?.[0] || 'leaders'} struggle with ${icp.pain_points?.[0] || 'similar challenges'}. Our solution has helped reduce these issues by up to 40%."\n\nAsk: "I'd love to show you how this could work for [Company Name]. Do you have 15 minutes this week for a quick demo?"`
        : `Hi [Name],\n\nI came across your profile and was impressed by your experience in ${icp.industries?.[0] || 'your field'}.\n\nI'm reaching out because we help ${icp.job_titles?.[0] || 'professionals like yourself'} overcome ${icp.pain_points?.[0] || 'industry challenges'}.\n\nWould you be open to a brief conversation about how we could help [Company] achieve ${icp.goals?.[0] || 'similar results'}?\n\nBest,\n[Your Name]`
      
      setGeneratedMessage(mockMessage)
      
      // Save message to database
      await supabase.from('message_generation_logs').insert({
        user_id: user.id,
        type: messageType,
        content: mockMessage,
        icp_id: icp.id,
        metadata: { linkedin_url: linkedinUrl },
      })
      
      // Update usage
      if (usage) {
        await supabase
          .from('usage_tracking')
          .update({
            messages_sent: usage.messages_sent + 1,
            messages_remaining: usage.messages_remaining - 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', usage.id)
        
        setUsage({
          ...usage,
          messages_sent: usage.messages_sent + 1,
          messages_remaining: usage.messages_remaining - 1,
        })
        
        setCanGenerate(usage.messages_remaining - 1 > 0)
      }
      
      toast.success('Message generated successfully!')
    } catch (error) {
      toast.error('Failed to generate message')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedMessage)
    toast.success('Message copied to clipboard!')
  }

  if (!isActive) {
    return (
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow widget-fade-in"
        onClick={onActivate}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Generate</CardTitle>
            </div>
            {usage && (
              <Badge variant={canGenerate ? 'default' : 'destructive'}>
                {usage.messages_remaining}/{FREE_TIER_LIMITS.MAX_MESSAGES}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create personalised outreach
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {usage ? `${usage.messages_remaining} messages left` : 'AI-powered generation'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-3 widget-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Generate Message</CardTitle>
            <CardDescription>Create personalised outreach messages</CardDescription>
          </div>
          <Badge variant={canGenerate ? 'default' : 'destructive'}>
            {usage?.messages_remaining || 0} messages remaining
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canGenerate && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  Monthly limit reached
                </p>
                <p className="text-xs text-muted-foreground">
                  You've used all {FREE_TIER_LIMITS.MAX_MESSAGES} free messages this month. 
                  Upgrade for unlimited generation.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="message_type">Message Type</Label>
            <Select
              value={messageType}
              onValueChange={(value: any) => setMessageType(value)}
              disabled={!canGenerate}
            >
              <SelectTrigger id="message_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="icp_select">ICP Profile</Label>
            <Select value={icp?.id || ''} disabled>
              <SelectTrigger id="icp_select">
                <SelectValue placeholder={icp?.name || 'No ICP created'} />
              </SelectTrigger>
              <SelectContent>
                {icp && (
                  <SelectItem value={icp.id}>{icp.name}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {messageType === 'linkedin' && (
          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn Profile URL (Optional)</Label>
            <Input
              id="linkedin_url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/prospect-profile"
              disabled={!canGenerate}
            />
            <p className="text-xs text-muted-foreground">
              Add a LinkedIn URL for more personalised messages
            </p>
          </div>
        )}
        
        <Button 
          onClick={handleGenerate} 
          disabled={loading || !canGenerate || !icp}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Message
            </>
          )}
        </Button>
        
        {generatedMessage && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Generated Message</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button size="sm" variant="outline" disabled>
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </Button>
              </div>
            </div>
            <Textarea
              value={generatedMessage}
              readOnly
              rows={8}
              className="font-mono text-sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
