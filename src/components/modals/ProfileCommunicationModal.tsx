// src/components/modals/ProfileCommunicationModal.tsx
import React, { useState, useEffect } from 'react'
import { BaseModal, ModalFooter, SectionCard } from './BaseModal'
import { useModalFlow } from './ModalFlowManager'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface CommunicationInfo {
  communicationStyle: string
  messageLength: string
  messageTypes: string[]
  messageSignoff: string
  defaultCta: string
  customCta: string
  phrasesToAvoid: string
  calendarLink: string
}

const communicationStyles = [
  { value: 'consultative', label: 'Consultative - Expert advisor approach' },
  { value: 'friendly', label: 'Friendly - Warm and approachable' },
  { value: 'professional', label: 'Professional - Formal and direct' },
  { value: 'casual', label: 'Casual - Relaxed and conversational' }
]

const messageLengths = [
  { value: 'brief', label: 'Brief (2-3 sentences)' },
  { value: 'moderate', label: 'Moderate (4-6 sentences)' },
  { value: 'detailed', label: 'Detailed (7-10 sentences)' }
]

const messageTypeOptions = [
  'LinkedIn Messages',
  'Email Outreach',
  'Call Scripts'
]

const ctaOptions = [
  { value: 'meeting', label: 'Book a meeting' },
  { value: 'call', label: 'Schedule a call' },
  { value: 'email', label: 'Reply via email' },
  { value: 'website', label: 'Visit website' },
  { value: 'soft', label: 'Low friction CTA [recommended]' },
  { value: 'custom', label: 'Custom goal...' }
]

export function ProfileCommunicationModal() {
  const { user } = useAuth()
  const { updateModalData, state, navigateNext, navigatePrevious, closeAllModals, openModal, markDataAsOriginal, hasUnsavedChanges, resetUnsavedChanges } = useModalFlow()
  const [formData, setFormData] = useState<CommunicationInfo>({
    communicationStyle: 'consultative',
    messageLength: 'moderate',
    messageTypes: ['LinkedIn Messages'],
    messageSignoff: 'Regards',
    defaultCta: 'soft',
    customCta: '',
    phrasesToAvoid: '',
    calendarLink: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingData, setHasExistingData] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)

  // Load existing data and onboarding status
  useEffect(() => {
    if (user?.id || user?.user_id) {
      loadCommunicationData()
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

  const loadCommunicationData = async () => {
    setIsLoading(true)
    const userId = user?.id || user?.user_id
    console.log('Loading communication data for user:', userId)

    try {
      const { data, error } = await supabase
        .from('communication_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data && !error) {
        const hasData = !!(data.communication_style || data.message_length ||
                          data.message_types || data.signature_style ||
                          data.cta_preference || data.avoid_phrases)

        // Ensure LinkedIn Messages is always included
        const messageTypes = data.message_types || ['LinkedIn Messages']
        if (!messageTypes.includes('LinkedIn Messages')) {
          messageTypes.push('LinkedIn Messages')
        }

        const commData: CommunicationInfo = {
          communicationStyle: data.communication_style || 'consultative',
          messageLength: data.message_length || 'moderate',
          messageTypes: messageTypes,
          messageSignoff: data.signature_style || 'Regards',
          defaultCta: data.cta_preference || 'soft',
          customCta: data.custom_cta || '',
          phrasesToAvoid: data.avoid_phrases ? data.avoid_phrases.join(', ') : '',
          calendarLink: data.calendar_link || ''
        }
        setFormData(commData)
        setHasExistingData(hasData)

        // Update modal data first, then immediately mark as original
        console.log('ProfileCommunicationModal: Updating modal data:', commData)
        updateModalData({ communicationInfo: commData })

        // Mark as original data immediately to prevent timing issues
        if (hasData) {
          console.log('ProfileCommunicationModal: Marking data as original:', commData)
          console.log('ProfileCommunicationModal: hasUnsavedChanges before marking:', hasUnsavedChanges())
          markDataAsOriginal({ communicationInfo: commData })
          console.log('ProfileCommunicationModal: hasUnsavedChanges after marking:', hasUnsavedChanges())
        } else {
          console.log('ProfileCommunicationModal: No existing data found')
        }

      }
    } catch (error) {
      console.error('Error loading communication data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof CommunicationInfo, value: string | string[]) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    updateModalData({ communicationInfo: newData })
  }

  const handleMessageTypeToggle = (type: string) => {
    // Don't allow LinkedIn Messages to be unchecked
    if (type === 'LinkedIn Messages') {
      return
    }

    const currentTypes = formData.messageTypes
    const updated = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type]

    handleInputChange('messageTypes', updated)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const userId = user?.id || user?.user_id
    console.log('Saving communication data for user:', userId)

    try {
      // Ensure LinkedIn Messages is always included when saving
      const messageTypes = [...formData.messageTypes]
      if (!messageTypes.includes('LinkedIn Messages')) {
        messageTypes.push('LinkedIn Messages')
      }

      const { error } = await supabase
        .from('communication_preferences')
        .upsert({
          user_id: userId,
          communication_style: formData.communicationStyle,
          message_length: formData.messageLength,
          message_types: messageTypes,
          signature_style: formData.messageSignoff,
          cta_preference: formData.defaultCta,
          custom_cta: formData.defaultCta === 'custom' ? formData.customCta : '',
          avoid_phrases: formData.phrasesToAvoid ? formData.phrasesToAvoid.split(',').map(p => p.trim()).filter(p => p) : [],
          calendar_link: formData.calendarLink,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      // Reset unsaved changes and mark new data as original
      resetUnsavedChanges()
      markDataAsOriginal({ communicationInfo: formData })
      setHasExistingData(true)

      toast.success('Communication preferences saved successfully')

      // Only show completion message and open Knowledge modal for first-time setup
      if (!hasExistingData) {
        // Mark onboarding as completed in users table
        const { error: onboardingError } = await supabase
          .from('users')
          .update({
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (onboardingError) {
          console.error('Error updating onboarding status:', onboardingError)
        } else {
          setOnboardingCompleted(true)
        }

        toast.success('Profile setup completed! Let\'s add your first product or service.')

        // Close current modal and open Knowledge modal after a short delay
        setTimeout(() => {
          closeAllModals()
          // Open Knowledge modal in 'add' mode after a short delay
          setTimeout(() => {
            openModal('knowledge', { mode: 'add' })
          }, 300)
        }, 1000) // Delay to show toast message
      }
    } catch (error) {
      console.error('Error saving communication data:', error)
      toast.error('Failed to save communication preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const validateForm = () => {
    return !!formData.communicationStyle
  }

  const handleComplete = () => {
    if (!validateForm()) {
      toast.error('Please select a communication style')
      return
    }
    handleSave()
  }

  const handleBack = () => {
    navigatePrevious()
  }

  if (isLoading) {
    return (
      <BaseModal title="Communication Preferences" description="Loading your preferences..." dismissible={onboardingCompleted}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-[#FBAE1C] border-t-transparent rounded-full animate-spin" />
        </div>
      </BaseModal>
    )
  }

  return (
    <BaseModal
      title="Communication Preferences"
      description="Customise how your messages sound"
      dismissible={onboardingCompleted}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div>
          <SectionCard title="Message Style" className="mb-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Communication Style <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.communicationStyle}
                  onChange={(e) => handleInputChange('communicationStyle', e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-white
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                >
                  {communicationStyles.map((style) => (
                    <option key={style.value} value={style.value} className="bg-gray-800">
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message Length - Only show if Email Outreach is selected */}
              {formData.messageTypes.includes('Email Outreach') && (
                <div>
                  <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                    Message Length
                  </label>
                  <select
                    value={formData.messageLength}
                    onChange={(e) => handleInputChange('messageLength', e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-white
                             bg-black/30 border border-white/10
                             focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                             transition-all duration-200"
                  >
                    {messageLengths.map((length) => (
                      <option key={length.value} value={length.value} className="bg-gray-800">
                        {length.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Outreach Goal
                </label>
                <select
                  value={formData.defaultCta}
                  onChange={(e) => handleInputChange('defaultCta', e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-white
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                >
                  {ctaOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-gray-800">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom CTA field - Only show if 'custom' is selected */}
              {formData.defaultCta === 'custom' && (
                <div>
                  <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                    Custom Goal Description
                  </label>
                  <input
                    type="text"
                    value={formData.customCta}
                    onChange={(e) => handleInputChange('customCta', e.target.value)}
                    placeholder="e.g., download whitepaper, register for webinar..."
                    className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                             bg-black/30 border border-white/10
                             focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                             transition-all duration-200"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Default Message Types
                </label>
                <div className="space-y-2">
                  {messageTypeOptions.map((type) => {
                    const isLinkedIn = type === 'LinkedIn Messages'
                    const isDisabled = !isLinkedIn // Disable everything except LinkedIn for free version

                    return (
                      <label key={type} className={`flex items-center gap-2 text-sm ${isDisabled ? 'opacity-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={formData.messageTypes.includes(type)}
                          onChange={() => handleMessageTypeToggle(type)}
                          disabled={isDisabled || isLinkedIn} // LinkedIn is always disabled (can't be unchecked)
                          className="rounded accent-[#FBAE1C] bg-black/30 border-white/20
                                   focus:ring-2 focus:ring-[#FBAE1C]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className={`text-white ${isDisabled ? 'text-gray-400' : ''}`}>
                          {type}
                          {isDisabled && (
                            <span className="ml-2 text-xs text-[#FBAE1C]">
                              (Upgrade for access)
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {/* Free Version Notice */}
                <div className="mt-3 p-3 bg-[#FBAE1C]/10 border border-[#FBAE1C]/20 rounded-lg">
                  <p className="text-xs text-[#FBAE1C]">
                    <strong>Free Version:</strong> LinkedIn messaging only.
                    <span className="underline cursor-pointer ml-1">Upgrade for email & call scripts</span>
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column */}
        <div>
          <SectionCard title="Message Details" titleColor="amber">
            <div className="space-y-4">
              {/* Message Sign-off - Only show if Email Outreach is selected */}
              {formData.messageTypes.includes('Email Outreach') && (
                <div>
                  <label className="text-sm font-medium text-amber-400 block mb-2">
                    Message Sign-off
                  </label>
                  <input
                    type="text"
                    value={formData.messageSignoff}
                    onChange={(e) => handleInputChange('messageSignoff', e.target.value)}
                    placeholder="e.g., Best regards, Cheers, Thanks"
                    className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                             bg-black/30 border border-white/10
                             focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                             transition-all duration-200"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-amber-400 block mb-2">
                  Calendar Link
                </label>
                <input
                  type="url"
                  value={formData.calendarLink}
                  onChange={(e) => handleInputChange('calendarLink', e.target.value)}
                  placeholder="https://calendly.com/your-link"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Your booking link for when prospects want to schedule a meeting
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-amber-400 block mb-2">
                  Phrases to Avoid
                </label>
                <textarea
                  rows={3}
                  value={formData.phrasesToAvoid}
                  onChange={(e) => handleInputChange('phrasesToAvoid', e.target.value)}
                  placeholder="Enter any phrases or words you want to avoid..."
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10 resize-none
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>

              {/* CTA Strategy Info Box */}
              <div className="mt-3 p-3 bg-[#FBAE1C]/10 border border-[#FBAE1C]/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#FBAE1C]/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="text-[#FBAE1C] text-xs font-bold">?</span>
                  </div>
                  <div>
                    <p className="text-xs text-[#FBAE1C] font-medium mb-1">
                      Smart CTA Strategy
                    </p>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Cold AI will gently guide conversations toward your CTA over 2-3 messages.
                      The first message focuses on starting a human conversation, then progressively moves
                      toward your goal.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <ModalFooter
        onBack={handleBack}
        onComplete={handleComplete}
        onSave={handleSave}
        backLabel="Back"
        completeLabel="Complete Setup"
        saveLabel="Save Changes"
        showBack={true}
        showNext={false}
        showComplete={true}
        isLoading={isSaving}
        dynamicMode={true}
        hasExistingData={hasExistingData}
        hasChanges={hasUnsavedChanges()}
        isFormValid={validateForm()}
      />
    </BaseModal>
  )
}