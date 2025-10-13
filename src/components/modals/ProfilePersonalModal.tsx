// src/components/modals/ProfilePersonalModal.tsx
import React, { useState, useEffect } from 'react'
import { BaseModal, ModalFooter, SectionCard } from './BaseModal'
import { useModalFlow } from './ModalFlowManager'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface PersonalInfo {
  firstName: string
  lastName: string
  position: string
  phone: string
  territory: string
  linkedinUrl: string
  bio: string
}

export function ProfilePersonalModal() {
  const { user } = useAuth()
  const { updateModalData, state, navigateNext, markDataAsOriginal, hasUnsavedChanges, resetUnsavedChanges } = useModalFlow()
  const [formData, setFormData] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    position: '',
    phone: '',
    territory: '',
    linkedinUrl: '',
    bio: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingData, setHasExistingData] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)

  // Load existing data and onboarding status
  useEffect(() => {
    if (user?.id) {
      loadProfileData()
      loadOnboardingStatus()
    }
  }, [user])

  // Note: Removed modal state effect to prevent feedback loops

  const loadOnboardingStatus = async () => {
    const userId = user?.id || user?.user_id
    try {
      const { data, error } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('user_id', userId)
        .single()

      if (data && !error) {
        setOnboardingCompleted(data.onboarding_completed || false)
      }
    } catch (error) {
      console.error('Error loading onboarding status:', error)
    }
  }

  const loadProfileData = async () => {
    setIsLoading(true)
    const userId = user?.id || user?.user_id
    console.log('Loading personal data for user:', userId)

    try {
      // Get user data (first_name, last_name)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('user_id', userId)
        .single()

      // Get user profile data (job_title, phone_number, etc.)
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!userError || !profileError) {
        const hasData = !!(userData?.first_name || userData?.last_name ||
                          profileData?.job_title || profileData?.phone_number ||
                          profileData?.territory || profileData?.linkedin_url ||
                          profileData?.personal_bio)

        const combinedData: PersonalInfo = {
          firstName: userData?.first_name || '',
          lastName: userData?.last_name || '',
          position: profileData?.job_title || '',
          phone: profileData?.phone_number || '',
          territory: profileData?.territory || '',
          linkedinUrl: profileData?.linkedin_url || '',
          bio: profileData?.personal_bio || ''
        }
        setFormData(combinedData)
        setHasExistingData(hasData)
        updateModalData({ personalInfo: combinedData })

        // Mark as original data immediately to prevent timing issues
        if (hasData) {
          console.log('ProfilePersonalModal: Marking data as original after load:', combinedData)
          markDataAsOriginal({ personalInfo: combinedData })
        } else {
          console.log('ProfilePersonalModal: No existing data found, not marking as original')
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof PersonalInfo, value: string) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    updateModalData({ personalInfo: newData })
  }

  const handleSave = async () => {
    setIsSaving(true)
    const userId = user?.id || user?.user_id
    console.log('Saving personal info for user:', userId)
    console.log('Form data:', formData)

    try {
      // Update users table (first_name, last_name)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()

      console.log('Users table update:', { userData, userError })

      // Update user_profiles table (use upsert with proper conflict resolution)
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          job_title: formData.position,
          phone_number: formData.phone,
          territory: formData.territory,
          linkedin_url: formData.linkedinUrl,
          personal_bio: formData.bio,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()

      console.log('User profiles table upsert:', { profileData, profileError })

      if (userError) throw userError
      if (profileError) throw profileError

      // Reset unsaved changes and mark new data as original
      resetUnsavedChanges()
      markDataAsOriginal({ personalInfo: formData })
      setHasExistingData(true)

      toast.success('Personal information saved successfully')

      // Only navigate to next if this is first time setup, not editing
      if (!hasExistingData) {
        navigateNext()
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error(`Failed to save personal information: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const validateForm = () => {
    return formData.firstName && formData.lastName && formData.position
  }

  const handleNext = () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields')
      return
    }
    handleSave()
  }


  if (isLoading) {
    return (
      <BaseModal title="Personal Information" description="Loading your profile..." dismissible={onboardingCompleted}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-[#FBAE1C] border-t-transparent rounded-full animate-spin" />
        </div>
      </BaseModal>
    )
  }

  return (
    <BaseModal
      title="Personal Information"
      description="Tell us about yourself to personalise your messages"
      dismissible={onboardingCompleted}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div>
          <SectionCard title="Basic Information" className="mb-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  First Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Your first name"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Last Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Your last name"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Job Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  placeholder="Your job title"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Contact Details">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Your phone number"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Territory/Region
                </label>
                <input
                  type="text"
                  value={formData.territory}
                  onChange={(e) => handleInputChange('territory', e.target.value)}
                  placeholder="Your location"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column */}
        <div>
          <SectionCard title="Professional Profile" titleColor="amber" className="mb-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-amber-400 block mb-2">
                  LinkedIn Profile
                </label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-amber-400 block mb-2">
                  Personal Bio
                </label>
                <textarea
                  rows={6}
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell us about your experience..."
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10 resize-none
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>
            </div>
          </SectionCard>

        </div>
      </div>

      <ModalFooter
        onNext={handleNext}
        onSave={handleSave}
        nextLabel="Next: Company Info"
        saveLabel="Save Changes"
        showBack={false}
        isLoading={isSaving}
        dynamicMode={true}
        hasExistingData={hasExistingData}
        hasChanges={hasUnsavedChanges()}
        isFormValid={validateForm()}
      />
    </BaseModal>
  )
}