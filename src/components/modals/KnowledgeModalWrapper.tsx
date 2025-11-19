// Wrapper for Knowledge modals to integrate with ModalFlowManager
import { useState } from 'react'
import { useModalFlow } from './ModalFlowManager'
import { useAuth } from '@/hooks/useAuth'
import { ProductAddModalEnhanced } from '../knowledge/ProductAddModalEnhanced'
import { KnowledgeDetailsModal } from '../knowledge/KnowledgeDetailsModal'
import { BaseModal } from './BaseModal'
import { toast } from 'sonner'

// Wrapper for creation modal
export function KnowledgeCreationModalWrapper() {
  const { state, openModal, closeModal } = useModalFlow()
  const { user } = useAuth()

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

  const [isProcessing, setIsProcessing] = useState(false)

  const handleAddEntry = async () => {
    if (!user) {
      toast.error("You must be logged in to add entries");
      return;
    }

    // Validation - just check URL is provided
    if (!newEntry.productLink) {
      toast.error("Please provide a URL");
      return;
    }

    setIsProcessing(true);

    try {
      // Minimal payload - just URL and type, AI will generate everything else
      const entryData = {
        knowledge_type: newEntry.knowledge_type,
        productLink: newEntry.productLink
      };

      console.log('Sending minimal entry to n8n:', entryData);

      // Use the n8n service directly to add the entry (will trigger n8n workflow)
      const { n8nService } = await import('@/services/n8nService');
      const result = await n8nService.addKnowledgeEntry(user.id, entryData);

      if (result.success) {
        console.log('Entry added successfully, opening generating modal');

        // Close current modal and open generating modal
        closeModal();
        openModal('knowledge-generating');
      } else {
        console.error('Failed to add entry:', result.error);
        toast.error(result.error || 'Failed to add entry');
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('Error adding entry:', error);
      toast.error(error.message || 'Failed to add entry');
      setIsProcessing(false);
    }
  };

  return (
    <BaseModal
      title="Add Product/Service"
      description="Add your product or service to the knowledge base"
    >
      <ProductAddModalEnhanced
        newEntry={newEntry}
        setNewEntry={setNewEntry}
        handleAddEntry={handleAddEntry}
        isProcessing={isProcessing}
      />
    </BaseModal>
  )
}

// Wrapper for edit/details modal
export function KnowledgeEditModalWrapper() {
  const { state } = useModalFlow()
  const existingEntry = state.data

  if (!existingEntry || !existingEntry.id) {
    console.warn('KnowledgeEditModalWrapper: No existing entry data')
    return null
  }

  return <KnowledgeDetailsModal entry={existingEntry} mode="edit" />
}

// Wrapper for view-only details modal
export function KnowledgeDetailsModalWrapper() {
  const { state } = useModalFlow()
  const existingEntry = state.data

  if (!existingEntry || !existingEntry.id) {
    console.warn('KnowledgeDetailsModalWrapper: No existing entry data', { state: state.data })
    return (
      <BaseModal title="Product/Service Details" description="Loading...">
        <div className="p-8 text-center text-gray-400">
          <p>No product data available</p>
        </div>
      </BaseModal>
    )
  }

  return <KnowledgeDetailsModal entry={existingEntry} mode="view" />
}
