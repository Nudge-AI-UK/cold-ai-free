// src/components/KnowledgeWidget.tsx
import { useState, useEffect } from 'react'
import { Plus, Edit2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { ProductAddModalEnhanced } from './knowledge/ProductAddModalEnhanced'
import type { KnowledgeEntry } from '@/types'

interface KnowledgeWidgetProps {
  forceEmpty?: boolean
  className?: string
}

export function KnowledgeWidget({ forceEmpty, className }: KnowledgeWidgetProps) {
  const { user } = useAuth()
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentStep, setCurrentStep] = useState(2)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newEntry, setNewEntry] = useState({
    knowledge_type: 'product',
    productLink: '',
    title: '',
    targetMarket: '',
    content: '',
    additionalLinks: []
  })
  const [aiFields, setAiFields] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user && !forceEmpty) {
      fetchKnowledge()
    }
  }, [user, forceEmpty])

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setCurrentStep(prev => prev >= 4 ? 2 : prev + 1)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [isGenerating])

  const fetchKnowledge = async () => {
    if (!user) return
    
    const { data } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('created_by', user.user_id)
      .limit(1)
      .single()

    if (data) {
      setEntry(data)
    }
  }

  const handleCreateProduct = () => {
    // Open the modal instead of simulating
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    // Reset form state
    setNewEntry({
      knowledge_type: 'product',
      productLink: '',
      title: '',
      targetMarket: '',
      content: '',
      additionalLinks: []
    })
    setAiFields(new Set())
  }

  const toggleAIField = (field: string) => {
    setAiFields(prev => {
      const newSet = new Set(prev)
      if (newSet.has(field)) {
        newSet.delete(field)
      } else {
        newSet.add(field)
      }
      return newSet
    })
  }

  const handleAddEntry = async () => {
    setIsGenerating(true)
    setIsModalOpen(false) // Close modal when processing starts
    
    try {
      // Your actual API call to create the product
      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          created_by: user?.user_id,
          knowledge_type: newEntry.knowledge_type,
          title: newEntry.title || 'AI Generated',
          content: newEntry.content || 'AI Generated',
          metadata: {
            productLink: newEntry.productLink,
            targetMarket: newEntry.targetMarket,
            aiFields: Array.from(aiFields)
          }
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Product created successfully!')
      setEntry(data)
      handleModalClose()
    } catch (error) {
      toast.error('Failed to create product')
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  // Knowledge types for the modal
  const knowledgeTypes = [
    { value: 'product', label: 'Product', icon: Plus },
    { value: 'service', label: 'Service', icon: Plus }
  ]

  // Empty State
  if (forceEmpty || (!entry && !isGenerating)) {
    return (
      <>
        <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
             style={{
               background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
               backdropFilter: 'blur(10px)',
               WebkitBackdropFilter: 'blur(10px)'
             }}>
          
          {/* Status Badge */}
          <div className="absolute top-4 right-4 z-30">
            <div className="bg-gray-700/50 text-gray-400 border border-gray-600/50 px-3 py-1 rounded-full text-xs">
              Not Created
            </div>
          </div>

          {/* Account Info */}
          <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
            Free Account: 1 Product/Service Limit
          </div>

          <div className="flex gap-8">
            {/* Left Side - Icon and Main Content */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-6 mb-4">
                {/* Floating Icon */}
                <div className="relative inline-block" style={{ animation: 'float 3s ease-in-out infinite' }}>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
                    <span className="text-4xl">📦</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                    1
                  </div>
                </div>
                
                {/* Title and Description */}
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2"
                      style={{
                        background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        animation: 'shimmer 3s linear infinite'
                      }}>
                    Add Your Product/Service
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Create your first product entry to maximise AI-powered message personalisation
                  </p>
                </div>
              </div>

              {/* Benefits Grid - Horizontal */}
              <div className="flex gap-3 mb-4">
                <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                       backdropFilter: 'blur(10px)'
                     }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <p className="text-xs text-gray-300">10x Response</p>
                  </div>
                </div>
                <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                       backdropFilter: 'blur(10px)'
                     }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <p className="text-xs text-gray-300">AI-Powered</p>
                  </div>
                </div>
                <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                       backdropFilter: 'blur(10px)'
                     }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚀</span>
                    <p className="text-xs text-gray-300">2min Setup</p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <button 
                onClick={handleCreateProduct}
                className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group">
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                <span>Create Your Product/Service Entry</span>
              </button>
            </div>

            {/* Right Side - What You'll Define */}
            <div className="w-80">
              <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
                <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">What You'll Define</h4>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FBAE1C] mt-1.5"></div>
                    <span className="text-xs text-gray-300">The pain points your product/service addresses</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FC9109] mt-1.5"></div>
                    <span className="text-xs text-gray-300">The key selling benefits</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#DD6800] mt-1.5"></div>
                    <span className="text-xs text-gray-300">Who you might be selling to</span>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                  Provide a product URL for AI-powered analysis
                </p>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
        </div>

        {/* Product Add Modal */}
        <ProductAddModalEnhanced
          isOpen={isModalOpen}
          onClose={handleModalClose}
          newEntry={newEntry}
          setNewEntry={setNewEntry}
          knowledgeTypes={knowledgeTypes}
          canAddAdditionalLinks={false} // Free tier
          getMaxAdditionalLinks={() => 0}
          subscription={{ plan_type: 'free' }}
          addAdditionalLink={() => {}}
          removeAdditionalLink={() => {}}
          updateAdditionalLink={() => {}}
          aiFields={aiFields}
          toggleAIField={toggleAIField}
          handleAddEntry={handleAddEntry}
          isProcessing={isGenerating}
        />
      </>
    )
  }

  // Generating State
  if (isGenerating) {
    return (
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5 animate-pulse"></span>
            Analysing
          </div>
        </div>

        {/* Account Info */}
        <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
          Creating your product profile...
        </div>

        <div className="flex gap-8">
          {/* Left Side - Generating Content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-6 mb-6">
              {/* AI Processing Icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-4xl">📦</span>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-purple-400 border-t-transparent animate-spin"></div>
              </div>
              
              {/* Loading Placeholders */}
              <div className="flex-1">
                <div className="h-7 rounded-lg mb-3 w-3/4 animate-pulse"
                     style={{
                       background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 1.5s infinite'
                     }}></div>
                <div className="h-4 rounded mb-2 w-full animate-pulse"
                     style={{
                       background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 1.5s infinite'
                     }}></div>
                <div className="h-4 rounded w-2/3 animate-pulse"
                     style={{
                       background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 1.5s infinite'
                     }}></div>
              </div>
            </div>

            {/* AI Generation Status */}
            <div className="bg-purple-500/10 backdrop-blur-sm rounded-xl p-4 mb-4 border border-purple-500/20">
              <div className="flex items-center justify-center space-x-3">
                <span className="text-lg">🤖</span>
                <p className="text-sm text-purple-300 font-medium">Cold AI is analysing your product URL</p>
                <div className="flex space-x-1">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            </div>

            {/* Key Features Skeleton */}
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded animate-pulse"
                       style={{
                         background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                         backgroundSize: '200% 100%',
                         animation: 'shimmer 1.5s infinite'
                       }}></div>
                  <div className={`h-4 rounded flex-1 animate-pulse`}
                       style={{
                         width: `${100 - (i * 5)}%`,
                         background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                         backgroundSize: '200% 100%',
                         animation: 'shimmer 1.5s infinite'
                       }}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Progress Steps */}
          <div className="w-80">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">Analysis Progress</h4>
              <div className="space-y-3">
                {/* Step 1 - Always completed */}
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-300">URL accessed</span>
                </div>
                
                {/* Steps 2-4 */}
                {[
                  { num: 2, text: 'Extracting product features' },
                  { num: 3, text: 'Identifying pain points' },
                  { num: 4, text: 'Building sales framework' }
                ].map(step => (
                  <div key={step.num} className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      currentStep === step.num 
                        ? 'bg-purple-500/20 border border-purple-500/30' 
                        : 'bg-gray-700/50 border border-gray-600'
                    }`}>
                      {currentStep === step.num ? (
                        <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse"></div>
                      ) : (
                        <span className="text-xs text-gray-500">{step.num}</span>
                      )}
                    </div>
                    <span className={`text-xs ${
                      currentStep === step.num ? 'text-gray-300 font-medium' : 'text-gray-500'
                    }`}>
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                Estimated time: 1-2 minutes
              </p>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Active State (when product exists)
  return (
    <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
         style={{
           background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
           backdropFilter: 'blur(10px)',
           WebkitBackdropFilter: 'blur(10px)'
         }}>
      
      {/* Status Badge */}
      <div className="absolute top-4 right-4 z-30">
        <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs flex items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
          Active
        </div>
      </div>

      {/* Account Info */}
      <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
        Last updated: {entry?.updated_at ? new Date(entry.updated_at).toLocaleString() : 'Never'}
      </div>

      <div className="flex gap-8">
        {/* Left Side - Product Details */}
        <div className="flex-1 flex flex-col">
          {/* Product Header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
              <span className="text-3xl">📦</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1"
                  style={{
                    background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animation: 'shimmer 3s linear infinite'
                  }}>
                {entry?.title || 'Product Name'}
              </h2>
              <p className="text-sm text-gray-400">
                {entry?.knowledge_type || 'Product'}
              </p>
            </div>
          </div>

          {/* Product Description */}
          <p className="text-sm text-gray-300 mb-4 leading-relaxed line-clamp-3">
            {entry?.content || 'Product description...'}
          </p>

          {/* Key Features from metadata if available */}
          {entry?.metadata?.features && (
            <div className="space-y-2 mb-4">
              {(entry.metadata.features as string[]).slice(0, 4).map((feature, i) => (
                <div key={i} className="rounded-lg p-2 border border-white/5 flex items-center gap-2"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                     }}>
                  <span className="text-green-400">✓</span>
                  <span className="text-xs text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          )}

          {/* View Button */}
          <button className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group">
            <Edit2 className="w-5 h-5" />
            <span>View Details</span>
          </button>
        </div>

        {/* Right Side - Metadata */}
        <div className="w-80">
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
            {/* Quality Assessment */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2 flex items-center gap-2">
                <span className="text-[#FBAE1C]">📊</span> Quality Assessment
              </h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">Completeness</span>
                    <span className="text-xs font-semibold text-[#FBAE1C]">
                      {entry?.metadata?.completeness || 92}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div className="h-1 rounded-full"
                         style={{
                           width: `${entry?.metadata?.completeness || 92}%`,
                           background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #DD6800 100%)'
                         }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">Sales Readiness</span>
                    <span className="text-xs font-semibold text-[#FBAE1C]">88%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div className="h-1 rounded-full"
                         style={{
                           width: '88%',
                           background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #DD6800 100%)'
                         }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3">
              {/* Product Info */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="text-gray-300">{entry?.knowledge_type || 'Product'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="text-gray-300">{entry?.workflow_status || 'Active'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">AI Generations</span>
                  <span className="text-gray-300">{entry?.ai_generation_count || 0}</span>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-white/5">
              Updated: {entry?.updated_at ? new Date(entry.updated_at).toLocaleDateString() : 'Never'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
    </div>
  )
}
