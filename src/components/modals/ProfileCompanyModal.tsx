// src/components/modals/ProfileCompanyModal.tsx
import React, { useState, useEffect } from 'react'
import { BaseModal, ModalFooter, SectionCard } from './BaseModal'
import { useModalFlow } from './ModalFlowManager'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface CompanyInfo {
  companyName: string
  industry: string
  companySize: string
  website: string
  companyLinkedin: string
  companyBio: string
}

const companySizes = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '500+ employees'
]

const industries = [
  'Technology/Software',
  'Healthcare/Medical',
  'Finance/Banking',
  'Education',
  'Manufacturing',
  'Retail/E-commerce',
  'Consulting',
  'Marketing/Advertising',
  'Real Estate',
  'Legal Services',
  'Insurance',
  'Construction',
  'Transportation/Logistics',
  'Media/Entertainment',
  'Non-profit',
  'Government',
  'Energy/Utilities',
  'Food & Beverage',
  'Travel/Hospitality',
  'Automotive',
  'Other'
]

export function ProfileCompanyModal() {
  const { user } = useAuth()
  const { updateModalData, state, navigateNext, navigatePrevious, markDataAsOriginal, hasUnsavedChanges, resetUnsavedChanges } = useModalFlow()
  const [formData, setFormData] = useState<CompanyInfo>({
    companyName: '',
    industry: '',
    companySize: '',
    website: '',
    companyLinkedin: '',
    companyBio: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingData, setHasExistingData] = useState(false)
  const [originalFormData, setOriginalFormData] = useState<CompanyInfo | null>(null)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)

  // Local change detection
  const hasLocalChanges = () => {
    if (!originalFormData) return false
    return JSON.stringify(formData) !== JSON.stringify(originalFormData)
  }

  // Load existing data and onboarding status
  useEffect(() => {
    if (user?.id || user?.user_id) {
      loadCompanyData()
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

  const loadCompanyData = async () => {
    setIsLoading(true)
    const userId = user?.id || user?.user_id
    console.log('Loading company data for user:', userId)

    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data && !error) {
        const hasData = !!(data.company_name || data.industry || data.company_size ||
                          data.website || data.company_linkedin_url || data.product_description)

        const companyData: CompanyInfo = {
          companyName: data.company_name || '',
          industry: data.industry || '',
          companySize: data.company_size || '',
          website: data.website || '',
          companyLinkedin: data.company_linkedin_url || '',
          companyBio: data.product_description || '' // Using product_description as bio
        }
        setFormData(companyData)
        setHasExistingData(hasData)

        // Update modal data first, then immediately mark as original
        updateModalData({ companyInfo: companyData })

        // Mark as original data immediately to prevent timing issues
        if (hasData) {
          console.log('ProfileCompanyModal: Marking data as original after load:', companyData)
          console.log('ProfileCompanyModal: hasUnsavedChanges before marking:', hasUnsavedChanges())
          markDataAsOriginal({ companyInfo: companyData })
          setOriginalFormData(companyData) // Store local copy
          console.log('ProfileCompanyModal: hasUnsavedChanges after marking:', hasUnsavedChanges())
        } else {
          console.log('ProfileCompanyModal: No existing data found, not marking as original')
          setOriginalFormData(companyData) // Still store as original even if empty
        }

      }
    } catch (error) {
      console.error('Error loading company data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof CompanyInfo, value: string) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    updateModalData({ companyInfo: newData })
  }

  const handleSave = async () => {
    setIsSaving(true)
    const userId = user?.id || user?.user_id
    console.log('Saving company data for user:', userId)

    try {
      const { error } = await supabase
        .from('business_profiles')
        .upsert({
          user_id: userId,
          company_name: formData.companyName,
          industry: formData.industry,
          company_size: formData.companySize,
          website: formData.website,
          company_linkedin_url: formData.companyLinkedin,
          product_description: formData.companyBio,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      // Reset unsaved changes and mark new data as original
      resetUnsavedChanges()
      markDataAsOriginal({ companyInfo: formData })
      setHasExistingData(true)

      toast.success('Company information saved successfully')

      // Only navigate to next if this is first time setup, not editing
      if (!hasExistingData) {
        navigateNext()
      }
    } catch (error) {
      console.error('Error saving company data:', error)
      toast.error('Failed to save company information')
    } finally {
      setIsSaving(false)
    }
  }

  const validateForm = () => {
    return formData.companyName && formData.industry
  }

  const handleNext = () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields')
      return
    }
    handleSave()
  }

  const handleBack = () => {
    navigatePrevious()
  }

  if (isLoading) {
    return (
      <BaseModal title="Company Information" description="Loading your company details..." dismissible={onboardingCompleted}>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-[#FBAE1C] border-t-transparent rounded-full animate-spin" />
        </div>
      </BaseModal>
    )
  }

  return (
    <BaseModal
      title="Company Information"
      description="Tell us about your business"
      dismissible={onboardingCompleted}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div>
          <SectionCard title="Company Details" className="mb-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="Your company name"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Industry <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-white
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                >
                  <option value="" className="bg-gray-800">Select industry</option>
                  {industries.map((industry) => (
                    <option key={industry} value={industry} className="bg-gray-800">
                      {industry}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                  Company Size
                </label>
                <select
                  value={formData.companySize}
                  onChange={(e) => handleInputChange('companySize', e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-white
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                >
                  <option value="" className="bg-gray-800">Select company size</option>
                  {companySizes.map((size) => (
                    <option key={size} value={size} className="bg-gray-800">
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column */}
        <div>
          <SectionCard title="Online Presence" titleColor="amber" className="mb-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-amber-400 block mb-2">
                  Company Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="yourcompany.com"
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-amber-400 block mb-2">
                  Company LinkedIn
                </label>
                <input
                  type="url"
                  value={formData.companyLinkedin}
                  onChange={(e) => handleInputChange('companyLinkedin', e.target.value)}
                  placeholder="https://linkedin.com/company/..."
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-400 font-medium
                           bg-black/30 border border-white/10
                           focus:outline-none focus:border-[#FBAE1C]/50 focus:ring-3 focus:ring-[#FBAE1C]/10
                           transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-amber-400 block mb-2">
                  Company Bio
                </label>
                <textarea
                  rows={4}
                  value={formData.companyBio}
                  onChange={(e) => handleInputChange('companyBio', e.target.value)}
                  placeholder="Briefly describe your company..."
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
        onBack={handleBack}
        onNext={handleNext}
        onSave={handleSave}
        backLabel="Back"
        nextLabel="Next: Communication"
        saveLabel="Save Changes"
        showBack={true}
        showNext={true}
        isLoading={isSaving}
        dynamicMode={true}
        hasExistingData={hasExistingData}
        hasChanges={hasLocalChanges()}
        isFormValid={validateForm()}
      />
    </BaseModal>
  )
}