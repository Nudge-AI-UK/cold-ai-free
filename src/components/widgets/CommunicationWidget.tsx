import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Save } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { COMMUNICATION_TONES, COMMUNICATION_STYLES } from '@/lib/constants'
import type { CommunicationPreferences } from '@/types'

interface CommunicationWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function CommunicationWidget({ isActive, onActivate }: CommunicationWidgetProps) {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<Partial<CommunicationPreferences>>({
    tone: 'professional',
    style: 'concise',
    emoji_use: false,
    personalisation_level: 'medium',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchPreferences()
    }
  }, [user])

  const fetchPreferences = async () => {
    if (!user) return

    const userId = user?.id || user?.user_id
    const { data, error } = await supabase
      .from('communication_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (data) {
      setPreferences(data)
    } else if (error?.code === 'PGRST116') {
      // Preferences don't exist, create defaults
      const { data: newPrefs } = await supabase
        .from('communication_preferences')
        .insert({
          user_id: userId,
          tone: 'professional',
          style: 'concise',
          emoji_use: false,
          personalisation_level: 'medium',
        })
        .select()
        .single()
      
      if (newPrefs) {
        setPreferences(newPrefs)
      }
    }
  }

  const handleSave = async () => {
    if (!user) return

    setLoading(true)
    const userId = user?.id || user?.user_id
    const { error } = await supabase
      .from('communication_preferences')
      .upsert({
        ...preferences,
        user_id: userId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      toast.error('Failed to save preferences')
    } else {
      toast.success('Communication preferences saved')
    }
    setLoading(false)
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
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Communication</CardTitle>
            </div>
            <Badge variant="secondary">Configured</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {preferences.tone} tone, {preferences.style} style
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {preferences.emoji_use ? 'Emojis enabled' : 'No emojis'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-2 widget-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Communication Preferences</CardTitle>
            <CardDescription>How should messages be written?</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading}
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select
              value={preferences.tone}
              onValueChange={(value: any) => setPreferences({ ...preferences, tone: value })}
            >
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMUNICATION_TONES.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="style">Style</Label>
            <Select
              value={preferences.style}
              onValueChange={(value: any) => setPreferences({ ...preferences, style: value })}
            >
              <SelectTrigger id="style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMUNICATION_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="personalisation">Personalisation Level</Label>
          <Select
            value={preferences.personalisation_level}
            onValueChange={(value: any) => setPreferences({ ...preferences, personalisation_level: value })}
          >
            <SelectTrigger id="personalisation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low - Generic messages</SelectItem>
              <SelectItem value="medium">Medium - Some personalisation</SelectItem>
              <SelectItem value="high">High - Highly personalised</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="emoji">Use Emojis</Label>
            <p className="text-sm text-muted-foreground">
              Include emojis in generated messages
            </p>
          </div>
          <Switch
            id="emoji"
            checked={preferences.emoji_use}
            onCheckedChange={(checked) => setPreferences({ ...preferences, emoji_use: checked })}
          />
        </div>
        
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm font-medium mb-1">Preview</p>
          <p className="text-xs text-muted-foreground">
            Messages will be {preferences.tone} and {preferences.style}, 
            with {preferences.personalisation_level} personalisation
            {preferences.emoji_use && ', including emojis'}.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}