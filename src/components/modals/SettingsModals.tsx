// src/components/modals/SettingsModals.tsx
import React, { useState } from 'react'
import { BaseModal, ModalFooter, SectionCard } from './BaseModal'
import { useModalFlow } from './ModalFlowManager'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Settings, User, Palette, Zap, CreditCard } from 'lucide-react'

export function SettingsAccountModal() {
  const { navigateNext, navigatePrevious } = useModalFlow()
  const { user } = useAuth()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Simulate save operation
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Account settings saved')
      navigateNext()
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BaseModal
      title="Account Settings"
      description="Manage your account preferences and security"
    >
      <div className="space-y-6">
        <SectionCard title="Profile Information" className="mb-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full rounded-xl px-4 py-3 text-white bg-black/30 border border-white/10 opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Security" titleColor="amber">
          <div className="space-y-4">
            <button className="w-full text-left p-3 rounded-xl bg-black/20 border border-white/10 hover:border-[#FBAE1C]/50 transition-all">
              <span className="text-white font-medium">Change Password</span>
              <p className="text-xs text-gray-400 mt-1">Update your account password</p>
            </button>
          </div>
        </SectionCard>
      </div>

      <ModalFooter
        onBack={navigatePrevious}
        onNext={handleSave}
        nextLabel="Next: Preferences"
        isLoading={isSaving}
        showBack={true}
        showNext={true}
      />
    </BaseModal>
  )
}

export function SettingsPreferencesModal() {
  const { navigateNext, navigatePrevious } = useModalFlow()
  const [isSaving, setIsSaving] = useState(false)
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    notifications: true,
    autoSave: true
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Preferences saved')
      navigateNext()
    } catch (error) {
      toast.error('Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BaseModal
      title="Preferences"
      description="Customise your Cold AI experience"
    >
      <div className="space-y-6">
        <SectionCard title="Appearance" className="mb-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#FBAE1C] block mb-2">
                Theme
              </label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-white bg-black/30 border border-white/10 focus:border-[#FBAE1C]/50"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Notifications" titleColor="amber">
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.notifications}
                onChange={(e) => setPreferences(prev => ({ ...prev, notifications: e.target.checked }))}
                className="rounded accent-[#FBAE1C]"
              />
              <span className="text-white">Email notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.autoSave}
                onChange={(e) => setPreferences(prev => ({ ...prev, autoSave: e.target.checked }))}
                className="rounded accent-[#FBAE1C]"
              />
              <span className="text-white">Auto-save drafts</span>
            </label>
          </div>
        </SectionCard>
      </div>

      <ModalFooter
        onBack={navigatePrevious}
        onNext={handleSave}
        backLabel="Back: Account"
        nextLabel="Next: Integrations"
        isLoading={isSaving}
        showBack={true}
        showNext={true}
      />
    </BaseModal>
  )
}

export function SettingsIntegrationsModal() {
  const { navigateNext, navigatePrevious } = useModalFlow()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Integration settings saved')
      navigateNext()
    } catch (error) {
      toast.error('Failed to save integration settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BaseModal
      title="Integrations"
      description="Connect Cold AI with your favorite tools"
    >
      <div className="space-y-6">
        <SectionCard title="Available Integrations" className="mb-6">
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-black/20 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium">LinkedIn</h4>
                  <p className="text-xs text-gray-400">Connect your LinkedIn account</p>
                </div>
                <button className="px-4 py-2 rounded-lg bg-[#FBAE1C] text-black font-medium hover:bg-[#FC9109] transition-colors">
                  Connect
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/20 border border-white/10 opacity-50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium">Salesforce</h4>
                  <p className="text-xs text-gray-400">Sync with your CRM (Pro plan)</p>
                </div>
                <span className="px-4 py-2 rounded-lg bg-gray-600 text-gray-300 text-sm">Pro Plan Required</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <ModalFooter
        onBack={navigatePrevious}
        onNext={handleSave}
        backLabel="Back: Preferences"
        nextLabel="Next: Billing"
        isLoading={isSaving}
        showBack={true}
        showNext={true}
      />
    </BaseModal>
  )
}

export function SettingsBillingModal() {
  const { navigatePrevious, closeAllModals } = useModalFlow()

  const handleComplete = () => {
    toast.success('Settings updated successfully')
    closeAllModals()
  }

  return (
    <BaseModal
      title="Billing & Subscription"
      description="Manage your subscription and billing information"
    >
      <div className="space-y-6">
        <SectionCard title="Current Plan" className="mb-6">
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#FBAE1C]/10 to-[#FC9109]/10 border border-[#FBAE1C]/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[#FBAE1C] font-medium">Free Plan</h4>
                <p className="text-xs text-gray-300">Basic features included</p>
              </div>
              <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-black font-medium hover:shadow-lg transition-all">
                Upgrade
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Usage" titleColor="amber">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Messages generated</span>
              <span className="text-white">12 / 50</span>
            </div>
            <div className="w-full bg-black/30 rounded-full h-2">
              <div className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] h-2 rounded-full" style={{ width: '24%' }}></div>
            </div>
          </div>
        </SectionCard>
      </div>

      <ModalFooter
        onBack={navigatePrevious}
        onComplete={handleComplete}
        backLabel="Back: Integrations"
        completeLabel="Complete Settings"
        showBack={true}
        showNext={false}
        showComplete={true}
      />
    </BaseModal>
  )
}