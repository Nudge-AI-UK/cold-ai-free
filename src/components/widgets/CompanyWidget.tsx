import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Building2, Save, X, Edit } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { COMPANY_SIZES } from '@/lib/constants'
import type { CompanyProfile } from '@/types'

interface CompanyWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function CompanyWidget({ isActive, onActivate }: CompanyWidgetProps) {
  const { user } = useAuth()
  const [company, setCompany] = useState<Partial<CompanyProfile>>({})
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (user) {
      fetchCompany()
    }
  }, [user])

  const fetchCompany = async () => {
    if (!user) return
    
    const { data, error } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setCompany(data)
    } else if (error?.code === 'PGRST116') {
      // Company profile doesn't exist, create one
      const { data: newCompany } = await supabase
        .from('company_profiles')
        .insert({ 
          user_id: user.id,
          company_name: ''
        })
        .select()
        .single()
      
      if (newCompany) {
        setCompany(newCompany)
      }
    }
  }

  const handleSave = async () => {
    if (!user || !company.company_name) {
      toast.error('Company name is required')
      return
    }
    
    setLoading(true)
    const { error } = await supabase
      .from('company_profiles')
      .upsert({
        ...company,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      toast.error('Failed to save company profile')
    } else {
      toast.success('Company profile saved successfully')
      setEditing(false)
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
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Company</CardTitle>
            </div>
            {company.company_name && (
              <Badge variant="secondary">Set</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {company.company_name || 'Configure company details'}
          </p>
          {company.industry && (
            <p className="text-xs text-muted-foreground mt-1">{company.industry}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-2 widget-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Company Profile</CardTitle>
            <CardDescription>Your company information for context</CardDescription>
          </div>
          <div className="flex space-x-2">
            {editing ? (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={loading}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false)
                    fetchCompany()
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={company.company_name || ''}
              onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
              disabled={!editing}
              placeholder="Your Company Ltd"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={company.industry || ''}
              onChange={(e) => setCompany({ ...company, industry: e.target.value })}
              disabled={!editing}
              placeholder="e.g. Technology, Finance"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company_size">Company Size</Label>
            <Select
              value={company.company_size || ''}
              onValueChange={(value) => setCompany({ ...company, company_size: value })}
              disabled={!editing}
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
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={company.website || ''}
              onChange={(e) => setCompany({ ...company, website: e.target.value })}
              disabled={!editing}
              placeholder="https://yourcompany.com"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="value_proposition">Value Proposition</Label>
          <Textarea
            id="value_proposition"
            value={company.value_proposition || ''}
            onChange={(e) => setCompany({ ...company, value_proposition: e.target.value })}
            disabled={!editing}
            placeholder="What unique value does your company provide?"
            rows={2}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="target_market">Target Market</Label>
          <Textarea
            id="target_market"
            value={company.target_market || ''}
            onChange={(e) => setCompany({ ...company, target_market: e.target.value })}
            disabled={!editing}
            placeholder="Describe your ideal customers..."
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  )
}