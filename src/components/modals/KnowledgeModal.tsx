// src/components/modals/KnowledgeModal.tsx
import { useState, useEffect, useRef } from 'react'
import { useModalFlow } from './ModalFlowManager'
import { useAuth } from '@/hooks/useAuth'
import { useSimpleSubscription } from '@/hooks/useSimpleSubscription'
import { supabase } from '@/integrations/supabase/client'
import { ProductAddModalEnhanced } from '../knowledge/ProductAddModalEnhanced'
import { KnowledgeDetailsModal } from '../knowledge/KnowledgeDetailsModal'
import { BaseModal, SectionCard } from './BaseModal'
import { User, Package, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export function KnowledgeModal() {
  const { state, openModal } = useModalFlow()
  const { user } = useAuth()
  const { planType } = useSimpleSubscription(user?.id)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [existingKnowledgeEntry, setExistingKnowledgeEntry] = useState<any>(null)


  // Check if we're in edit mode
  const isEditMode = state.mode === 'edit'

  // Use a ref to persist entry data across navigation, with sessionStorage backup
  const persistedEntryRef = useRef<any>(null)

  // Try to restore from sessionStorage on mount
  useEffect(() => {
    if (isEditMode && !persistedEntryRef.current) {
      const stored = sessionStorage.getItem('knowledgeModal_entryData')
      if (stored) {
        try {
          persistedEntryRef.current = JSON.parse(stored)
        } catch (e) {
          console.error('Failed to parse stored entry data:', e)
        }
      }
    }
  }, [isEditMode])

  // Store entry data when first opened, then use persisted data if state.data is cleared or empty
  const existingEntry = (state.data && state.data.id) ? state.data : persistedEntryRef.current

  // Store entry data in ref and sessionStorage when first available
  useEffect(() => {
    if (isEditMode && state.data && state.data.id && !persistedEntryRef.current) {
      persistedEntryRef.current = state.data
      sessionStorage.setItem('knowledgeModal_entryData', JSON.stringify(state.data))
    } else if (!isEditMode) {
      persistedEntryRef.current = null
      sessionStorage.removeItem('knowledgeModal_entryData')
    }
  }, [isEditMode, state.data])

  // Clean up sessionStorage when component unmounts
  useEffect(() => {
    return () => {
      if (!isEditMode) {
        sessionStorage.removeItem('knowledgeModal_entryData')
      }
    }
  }, [isEditMode])

  // State for the ProductAddModalEnhanced
  const [newEntry, setNewEntry] = useState({
    knowledge_type: 'product',
    title: '',
    productLink: '',
    content: '',
    targetMarket: '',
    additionalLinks: [],
    infoLink: '',
    keyStatistics: ''
  })

  // Update state when edit mode data is available
  useEffect(() => {
    if (isEditMode && existingEntry) {
      // Extract productLink from metadata - check various possible field names
      const productLink = existingEntry.metadata?.source_info?.research_url ||
                         existingEntry.metadata?.source_info?.url ||
                         existingEntry.metadata?.source_info?.original_url ||
                         existingEntry.metadata?.productLink ||
                         existingEntry.metadata?.product_link ||
                         existingEntry.metadata?.url ||
                         existingEntry.metadata?.link ||
                         ''

      const formData = {
        knowledge_type: existingEntry.knowledge_type || 'product',
        title: existingEntry.title || '',
        productLink: productLink,
        content: existingEntry.content || '',
        targetMarket: existingEntry.metadata?.targetMarket ||
                     existingEntry.metadata?.target_market || '',
        additionalLinks: existingEntry.metadata?.additionalLinks ||
                        existingEntry.metadata?.additional_links || []
      }

      setNewEntry(formData)
    }
  }, [isEditMode, existingEntry])

  const [aiFields, setAiFields] = useState(new Set(['title', 'content', 'targetMarket']))
  const [isProcessing, setIsProcessing] = useState(false)

  // Check for existing knowledge entries when in add mode (for navigation from other modals)
  useEffect(() => {
    const fetchExistingKnowledge = async () => {
      const userId = user?.id
      if (!isEditMode && userId) {
        try {
          const { data: entries, error } = await supabase
            .from('knowledge_base')
            .select('*')
            .eq('created_by', userId)
            .order('created_at', { ascending: false })
            .limit(1)


          if (!error && entries && entries.length > 0) {
            setExistingKnowledgeEntry(entries[0])
          } else {
            setExistingKnowledgeEntry(null)
          }
        } catch (error) {
          console.error('Error fetching existing knowledge:', error)
          setExistingKnowledgeEntry(null)
        }
      } else {
      }
    }

    fetchExistingKnowledge()
      .catch(err => console.error('fetchExistingKnowledge error:', err))
  }, [isEditMode, user?.id])

  // Check if user has completed profile setup (only in add mode)
  useEffect(() => {
    const checkProfileData = async () => {

      // Skip profile check in edit mode
      if (isEditMode) {
        setHasProfile(true)
        setIsLoading(false)
        return
      }

      const userId = user?.id
      if (!userId) {
        return
      }

      setIsLoading(true)
      try {
        // Check users table for basic info
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('user_id', userId)
          .single()

        // Check user_profiles table for additional info
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('job_title, phone_number, territory')
          .eq('user_id', userId)
          .single()


        // User has profile data if they have any basic information
        const hasData = !!(
          userData?.first_name ||
          userData?.last_name ||
          profileData?.job_title
        )

        setHasProfile(hasData)
      } catch (error) {
        console.error('Error checking profile data:', error)
        setHasProfile(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkProfileData()
      .catch(err => console.error('checkProfileData error:', err))
  }, [user, isEditMode])

  // Knowledge types for free version (product and service only)
  const knowledgeTypes = [
    { value: 'product', label: 'Product', icon: Package, color: 'from-orange-500 to-amber-600' },
    { value: 'service', label: 'Service', icon: Package, color: 'from-orange-500 to-amber-600' }
  ]

  // Free version limitations
  const canAddAdditionalLinks = planType !== 'free' // Always false for free
  const getMaxAdditionalLinks = () => 0 // Always 0 for free

  const addAdditionalLink = () => {
    // No-op for free version
  }

  const removeAdditionalLink = () => {
    // No-op for free version
  }

  const updateAdditionalLink = () => {
    // No-op for free version
  }

  const toggleAIField = (field: string) => {
    const newAiFields = new Set(aiFields)
    if (newAiFields.has(field)) {
      newAiFields.delete(field)
    } else {
      newAiFields.add(field)
    }
    setAiFields(newAiFields)
  }

  const handleAddEntry = async () => {
    if (!user) {
      console.error("You must be logged in to add entries");
      return;
    }

    // Validation based on knowledge type
    if (newEntry.knowledge_type === 'product') {
      if (!newEntry.productLink) {
        console.error("Please provide a product link");
        return;
      }
    }

    setIsProcessing(true);

    try {
      // Build a streamlined entry object for the service
      // "content" field in the form represents the description
      const entryData: any = {
        // Core fields
        title: aiFields.has('title') ? 'fill_with_ai' : (newEntry.title || `${newEntry.knowledge_type} - ${new Date().toLocaleDateString('en-GB')}`),
        description: aiFields.has('content') ? 'fill_with_ai' : (newEntry.content || ''), // Map content to description
        knowledge_type: newEntry.knowledge_type,

        // Type-specific fields
        productLink: newEntry.knowledge_type === 'product' ? (newEntry.productLink || '') : '',
        targetMarket: newEntry.knowledge_type === 'product' ?
          (aiFields.has('targetMarket') ? 'fill_with_ai' : (newEntry.targetMarket || '')) : '',
        infoLink: (newEntry.knowledge_type === 'company' || newEntry.knowledge_type === 'case_study') ?
          (newEntry.infoLink || '') : '',
        keyStatistics: newEntry.knowledge_type === 'case_study' ?
          (aiFields.has('keyStatistics') ? 'fill_with_ai' : (newEntry.keyStatistics || '')) : '',
        additionalLinks: newEntry.knowledge_type === 'product' ?
          (newEntry.additionalLinks?.filter((link: any) => link.url && link.title) || []) : [],

        // AI fields tracking
        aiFieldsRequested: Array.from(aiFields)
      };

      // Build metadata (only for database storage, not for n8n)
      const metadata = {
        aiFieldsRequested: Array.from(aiFields),
        aiFields: Array.from(aiFields) // For compatibility
      };

      // Log what we're sending for debugging

      // Use the n8n service directly to add the entry (will trigger n8n workflow)
      const { n8nService } = await import('@/services/n8nService');
      const result = await n8nService.addKnowledgeEntry({
        ...entryData,
        content: entryData.description, // n8nService expects "content" field
        metadata, // Include metadata for database storage
        userId: user?.id
      });

      if (result.success) {
        const message = aiFields.size > 0
          ? "Knowledge base entry added. AI is generating the requested content..."
          : "Knowledge base entry has been added successfully";

        console.log("Success!", message);
        toast.success(message);

        // Refresh the page to show the generating widget
        setTimeout(() => {
          window.location.reload()
        }, 1000) // Delay to ensure toast message shows
      } else {
        throw new Error(result.error || 'Failed to add entry');
      }
    } catch (error) {
      console.error('Error adding knowledge entry:', error);
      // Error will be shown in the UI by the ProductAddModalEnhanced component
    } finally {
      setIsProcessing(false);
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <BaseModal
        title={isEditMode ? "Edit Product/Service" : "Add Product/Service"}
        description="Loading your profile information..."
      >
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-[#FBAE1C] border-t-transparent rounded-full animate-spin" />
        </div>
      </BaseModal>
    )
  }

  // Show profile completion requirement (but allow edit mode even without profile)
  if (!hasProfile && !isEditMode) {
    return (
      <BaseModal
        title="Complete Your Profile First"
        description="You need to complete your profile before adding products or services"
      >
        <div className="space-y-6">
          <SectionCard title="Profile Setup Required">
            <div className="text-center py-8">
              <User className="w-16 h-16 text-[#FBAE1C] mx-auto mb-4" />
              <h3 className="text-white font-medium mb-2">Profile Information Needed</h3>
              <p className="text-gray-400 text-sm mb-6">
                Please complete your personal and company information first. This helps us provide better AI-generated content for your products and services.
              </p>
              <button
                onClick={() => openModal('profile-personal')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-black font-medium hover:shadow-lg transition-all"
              >
                Complete Profile
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </SectionCard>
        </div>
      </BaseModal>
    )
  }

  // Render the appropriate modal based on mode and available data
  if (isEditMode) {
    // Ensure we have valid entry data before rendering details modal
    if (!existingEntry) {
      console.warn('KnowledgeModal: existingEntry is null in edit mode')
      return null
    }
    return <KnowledgeDetailsModal entry={existingEntry} />
  }

  // Debug logging for render decisions

  // If in add mode but we have existing knowledge (navigated from other modals), show details
  if (existingKnowledgeEntry) {
    return <KnowledgeDetailsModal entry={existingKnowledgeEntry} />
  }

  // If we have existing data from flow navigation, show details even in "add" mode
  if (!isEditMode && existingEntry) {
    return <KnowledgeDetailsModal entry={existingEntry} />
  }

  // Render add mode modal (when no existing knowledge)
  return (
    <BaseModal
      title="Add Product/Service"
      description="Add your product or service to the knowledge base"
      className="knowledge-modal-large !max-w-[95vw]"
    >
      <ProductAddModalEnhanced
        key={isEditMode ? existingEntry?.id || 'edit' : 'add'} // Force re-render when switching modes
        newEntry={newEntry}
        setNewEntry={setNewEntry}
        knowledgeTypes={knowledgeTypes}
        canAddAdditionalLinks={canAddAdditionalLinks}
        getMaxAdditionalLinks={getMaxAdditionalLinks}
        subscription={{ planType }}
        addAdditionalLink={addAdditionalLink}
        removeAdditionalLink={removeAdditionalLink}
        updateAdditionalLink={updateAdditionalLink}
        aiFields={aiFields}
        toggleAIField={toggleAIField}
        handleAddEntry={handleAddEntry}
        isProcessing={isProcessing}
      />
    </BaseModal>
  )
}