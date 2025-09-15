import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Save, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { FREE_TIER_LIMITS } from '@/lib/constants'
import type { KnowledgeEntry } from '@/types'

interface KnowledgeWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function KnowledgeWidget({ isActive, onActivate }: KnowledgeWidgetProps) {
  const { user } = useAuth()
  const [entry, setEntry] = useState<Partial<KnowledgeEntry>>({
    title: '',
    content: '',
    category: 'product',
  })
  const [loading, setLoading] = useState(false)
  const [hasEntry, setHasEntry] = useState(false)

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
      .eq('user_id', user.id)
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

  if (!isActive) {
    return (
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow widget-fade-in"
        onClick={onActivate}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Knowledge Base</CardTitle>
            </div>
            {hasEntry ? (
              <Badge variant="secondary">1/1</Badge>
            ) : (
              <Badge variant="outline">0/1</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {hasEntry ? entry.title : 'Add your product info'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Free: 1 entry allowed
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