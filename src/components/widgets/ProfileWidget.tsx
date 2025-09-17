import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { User, Save, X, Edit } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { Profile } from '@/types'

interface ProfileWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function ProfileWidget({ isActive, onActivate }: ProfileWidgetProps) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setProfile(data)
    } else if (error?.code === 'PGRST116') {
      // Profile doesn't exist, create one
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ user_id: user.id })
        .select()
        .single()
      
      if (newProfile) {
        setProfile(newProfile)
      }
    }
  }

  const handleSave = async () => {
    if (!user) return
    
    setLoading(true)
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        ...profile,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      toast.error('Failed to save profile')
    } else {
      toast.success('Profile saved successfully')
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
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Profile</CardTitle>
            </div>
            {profile.first_name && profile.last_name && (
              <Badge variant="secondary">Complete</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {profile.first_name && profile.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : 'Set up your profile'}
          </p>
          {profile.job_title && (
            <p className="text-xs text-muted-foreground mt-1">{profile.job_title}</p>
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
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>Personal information for message personalisation</CardDescription>
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
                    fetchProfile()
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
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              value={profile.first_name || ''}
              onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
              disabled={!editing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              value={profile.last_name || ''}
              onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
              disabled={!editing}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="job_title">Job Title</Label>
          <Input
            id="job_title"
            value={profile.job_title || ''}
            onChange={(e) => setProfile({ ...profile, job_title: e.target.value })}
            disabled={!editing}
            placeholder="e.g. Sales Manager"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="linkedin_url">LinkedIn URL</Label>
          <Input
            id="linkedin_url"
            value={profile.linkedin_url || ''}
            onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
            disabled={!editing}
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={profile.bio || ''}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            disabled={!editing}
            placeholder="Tell us about yourself..."
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  )
}