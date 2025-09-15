import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Target, Save, Lock, Plus, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { COMPANY_SIZES } from '@/lib/constants'
import type { ICP } from '@/types'

interface ICPWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function ICPWidget({ isActive, onActivate }: ICPWidgetProps) {
  const { user } = useAuth()
  const [icp, setIcp] = useState<Partial<ICP>>({
    name: '',
    job_titles: [],
    industries: [],
    company_size: '',
    pain_points: [],
    goals: [],
  })
  const [loading, setLoading] = useState(false)
  const [hasICP, setHasICP] = useState(false)
  
  // Input states for array fields
  const [jobTitleInput, setJobTitleInput] = useState('')
  const [industryInput, setIndustryInput] = useState('')
  const [painPointInput, setPainPointInput] = useState('')
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => {
    if (user) {
      fetchICP()
    }
  }, [user])

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
      setHasICP(true)
    }
  }

  const handleSave = async () => {
    if (!user || !icp.name) {
      toast.error('ICP name is required')
      return
    }
    
    setLoading(true)
    
    if (hasICP && icp.id) {
      // Update existing ICP
      const { error } = await supabase
        .from('icps')
        .update({
          name: icp.name,
          job_titles: icp.job_titles || [],
          industries: icp.industries || [],
          company_size: icp.company_size || '',
          pain_points: icp.pain_points || [],
          goals: icp.goals || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', icp.id)

      if (error) {
        toast.error('Failed to update ICP')
      } else {
        toast.success('ICP updated successfully')
      }
    } else {
      // Create new ICP
      const { data, error } = await supabase
        .from('icps')
        .insert({
          user_id: user.id,
          name: icp.name,
          job_titles: icp.job_titles || [],
          industries: icp.industries || [],
          company_size: icp.company_size || '',
          pain_points: icp.pain_points || [],
          goals: icp.goals || [],
        })
        .select()
        .single()

      if (error) {
        toast.error('Failed to create ICP')
      } else if (data) {
        setIcp(data)
        setHasICP(true)
        toast.success('ICP created successfully')
      }
    }
    
    setLoading(false)
  }

  const addToArray = (field: 'job_titles' | 'industries' | 'pain_points' | 'goals', value: string) => {
    if (value.trim()) {
      setIcp({
        ...icp,
        [field]: [...(icp[field] || []), value.trim()],
      })
    }
  }

  const removeFromArray = (field: 'job_titles' | 'industries' | 'pain_points' | 'goals', index: number) => {
    setIcp({
      ...icp,
      [field]: (icp[field] || []).filter((_, i) => i !== index),
    })
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
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">ICP</CardTitle>
            </div>
            {hasICP ? (
              <Badge variant="secondary">1/1</Badge>
            ) : (
              <Badge variant="outline">0/1</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {hasICP ? icp.name : 'Define your ideal customer'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Free: 1 profile allowed
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
            <CardTitle>Ideal Customer Profile</CardTitle>
            <CardDescription>Define who you're targeting</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              <Lock className="h-3 w-3 mr-1" />
              Free: 1 ICP
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="icp_name">Profile Name *</Label>
            <Input
              id="icp_name"
              value={icp.name || ''}
              onChange={(e) => setIcp({ ...icp, name: e.target.value })}
              placeholder="e.g. Enterprise Sales Leaders"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_size">Company Size</Label>
            <Select
              value={icp.company_size || ''}
              onValueChange={(value) => setIcp({ ...icp, company_size: value })}
            >
              <SelectTrigger id="company_size">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Job Titles</Label>
          <div className="flex gap-2">
            <Input
              value={jobTitleInput}
              onChange={(e) => setJobTitleInput(e.target.value)}
              placeholder="e.g. Sales Director"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addToArray('job_titles', jobTitleInput)
                  setJobTitleInput('')
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                addToArray('job_titles', jobTitleInput)
                setJobTitleInput('')
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {icp.job_titles?.map((title, i) => (
              <Badge key={i} variant="secondary">
                {title}
                <button
                  onClick={() => removeFromArray('job_titles', i)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Industries</Label>
          <div className="flex gap-2">
            <Input
              value={industryInput}
              onChange={(e) => setIndustryInput(e.target.value)}
              placeholder="e.g. Technology"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addToArray('industries', industryInput)
                  setIndustryInput('')
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                addToArray('industries', industryInput)
                setIndustryInput('')
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {icp.industries?.map((industry, i) => (
              <Badge key={i} variant="secondary">
                {industry}
                <button
                  onClick={() => removeFromArray('industries', i)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Pain Points</Label>
          <Textarea
            value={painPointInput}
            onChange={(e) => setPainPointInput(e.target.value)}
            placeholder="What challenges do they face?"
            rows={2}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              addToArray('pain_points', painPointInput)
              setPainPointInput('')
            }}
          >
            Add Pain Point
          </Button>
          <div className="space-y-1">
            {icp.pain_points?.map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">•</span>
                <span className="flex-1">{point}</span>
                <button
                  onClick={() => removeFromArray('pain_points', i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}