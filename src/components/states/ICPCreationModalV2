import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, 
  Package, 
  Target,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info,
  ChevronRight,
  CloudUpload,
  FileText,
  Brain
} from 'lucide-react';
import { toast } from 'sonner';
import { icpService } from '@/services/icpService';
import { useAuth } from '@/hooks/useAuth';
import { useSimpleSubscription } from '@/hooks/useSimpleSubscription';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ICPFormData } from '@/types/icp';
import { ICP_FIELD_LIMITS } from '@/types/icp';

interface ICPCreationModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onGenerate?: (data: { title: string; productName: string; productId: string; icpId?: number }) => void;
}

interface Product {
  id: string;
  name: string;
  description: string;
}

const initialFormData: ICPFormData = {
  icp_title: '',
  product_id: '',
  target_company_maturity: '',
  buying_triggers: 'FILL_WITH_AI',
  champion_profile: '',
  decision_criteria: 'FILL_WITH_AI',
  objection_patterns: 'FILL_WITH_AI',
  success_metrics: '',
  engagement_preference: 'FILL_WITH_AI',
  budget_authority: 'FILL_WITH_AI',
  competitive_alternatives: ''
};

export const ICPCreationModalV2: React.FC<ICPCreationModalV2Props> = ({
  isOpen,
  onClose,
  onSuccess,
  onGenerate
}) => {
  const { user } = useAuth();
  const { planType, teamMembership } = useSimpleSubscription(user?.user_id);
  const [formData, setFormData] = useState<ICPFormData>(initialFormData);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('create');
  const [aiFields, setAiFields] = useState<Set<string>>(new Set([
    'buying_triggers',
    'decision_criteria',
    'objection_patterns',
    'engagement_preference',
    'budget_authority'
  ]));

  // Load user's products on mount
  useEffect(() => {
    const loadProducts = async () => {
      if (!user?.user_id) return;

      try {
        // Fetch ALL products from knowledge base with more inclusive query
        // Check for products that are approved, active, or live
        const { data: knowledgeData, error } = await supabase
          .from('knowledge_base')
          .select('id, title, content, knowledge_type, review_status, workflow_status, created_at')
          .eq('knowledge_type', 'product')
          .or('review_status.eq.approved,workflow_status.eq.active,workflow_status.eq.live,review_status.is.null');

        console.log('Products query result:', { knowledgeData, error });

        if (!error && knowledgeData && Array.isArray(knowledgeData)) {
          const productsList = knowledgeData.map((item: any) => ({
            id: item.id?.toString() || '',
            name: item.title || 'Unknown Product',
            description: item.content || ''
          }));
          setProducts(productsList);
          
          console.log(`Found ${productsList.length} products for ICP creation:`, productsList);
          
          // Debug: Show what statuses the products have
          if (productsList.length === 0 && knowledgeData.length === 0) {
            console.log('No products found. Checking all knowledge_base entries...');
            
            // Do a broader query to help debug
            const { data: allProducts } = await supabase
              .from('knowledge_base')
              .select('id, title, knowledge_type, review_status, workflow_status')
              .eq('knowledge_type', 'product');
              
            console.log('All product entries in knowledge_base:', allProducts);
          }
        } else {
          setProducts([]);
          if (error) {
            console.error('Error loading products:', error);
          }
        }
      } catch (error) {
        console.error('Error loading products:', error);
        setProducts([]);
      }
    };

    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, user?.user_id]);

  const handleClose = () => {
    setFormData(initialFormData);
    setAiFields(new Set([
      'buying_triggers',
      'decision_criteria',
      'objection_patterns',
      'engagement_preference',
      'budget_authority'
    ]));
    setActiveTab('create');
    onClose();
  };

  const toggleAIField = (field: string) => {
    const newAiFields = new Set(aiFields);
    if (newAiFields.has(field)) {
      newAiFields.delete(field);
      setFormData(prev => ({ ...prev, [field]: '' }));
    } else {
      newAiFields.add(field);
      setFormData(prev => ({ ...prev, [field]: 'FILL_WITH_AI' }));
    }
    setAiFields(newAiFields);
  };

  const handleFieldChange = (field: keyof ICPFormData, value: string) => {
    const limit = ICP_FIELD_LIMITS[field];
    if (limit && value.length > limit) {
      return; // Don't update if over limit
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!aiFields.has('icp_title') && !formData.icp_title.trim()) {
      toast.error('Please provide an ICP title or let AI generate one');
      return;
    }
    if (!formData.product_id) {
      toast.error('Please select a product');
      return;
    }
    if (!formData.target_company_maturity) {
      toast.error('Please select target company maturity');
      return;
    }

    if (!user?.user_id) {
      toast.error('User not authenticated');
      return;
    }

    const selectedProduct = products.find(p => p.id === formData.product_id);
    if (!selectedProduct) {
      toast.error('Invalid product selected');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare ICP data for the new service
      const icpData = {
        icp_name: aiFields.has('icp_title') ? 'AI Generated ICP' : formData.icp_title,
        description: `ICP for ${selectedProduct.name} targeting ${formData.target_company_maturity} companies`,
        product_link_id: formData.product_id,
        
        // Convert form fields to arrays where needed
        job_titles: aiFields.has('champion_profile') ? ['FILL_WITH_AI'] : 
                   formData.champion_profile ? [formData.champion_profile] : [],
        
        pain_points: aiFields.has('objection_patterns') ? ['FILL_WITH_AI'] : 
                    formData.objection_patterns ? formData.objection_patterns.split(',').map(s => s.trim()) : [],
        
        value_drivers: aiFields.has('success_metrics') ? ['FILL_WITH_AI'] : 
                      formData.success_metrics ? formData.success_metrics.split(',').map(s => s.trim()) : [],
        
        industry_focus: [], // Will be filled by AI
        
        company_characteristics: `Maturity: ${formData.target_company_maturity}`,
        
        // Optional fields
        decision_making_process: aiFields.has('decision_criteria') ? 'FILL_WITH_AI' : formData.decision_criteria,
        objections_and_concerns: aiFields.has('objection_patterns') ? ['FILL_WITH_AI'] : 
                                formData.objection_patterns ? [formData.objection_patterns] : [],
        success_metrics: aiFields.has('success_metrics') ? ['FILL_WITH_AI'] : 
                        formData.success_metrics ? [formData.success_metrics] : [],
        preferred_communication_channels: aiFields.has('engagement_preference') ? ['FILL_WITH_AI'] : 
                                         formData.engagement_preference ? [formData.engagement_preference] : [],
        competitive_alternatives: aiFields.has('competitive_alternatives') ? ['FILL_WITH_AI'] : 
                                 formData.competitive_alternatives ? [formData.competitive_alternatives] : [],
        budget_range: aiFields.has('budget_authority') ? 'FILL_WITH_AI' : formData.budget_authority,
        
        // Strategic fields stored in metadata
        metadata: {
          buying_triggers: aiFields.has('buying_triggers') ? 'FILL_WITH_AI' : formData.buying_triggers,
          target_company_maturity: formData.target_company_maturity,
          ai_generation_requested: true,
          product_context: {
            name: selectedProduct.name,
            description: selectedProduct.description
          }
        }
      };

      console.log('🚀 Creating ICP with new service:', icpData);

      const result = await icpService.createICP(icpData as any);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create ICP');
      }

      console.log('✅ ICP creation started:', result);

      // Notify parent component about the new generating ICP
      if (onGenerate) {
        onGenerate({
          title: icpData.icp_name,
          productName: selectedProduct.name,
          productId: formData.product_id,
          icpId: result.data?.icp_id
        });
      }

      toast.success('ICP creation started! AI is generating your profile...');
      
      // Reset form
      handleClose();
      onSuccess();
      
    } catch (error: any) {
      console.error('❌ Error creating ICP:', error);
      
      // Check if it's a subscription limit error
      if (error.message?.includes('limit reached')) {
        toast.error(error.message, {
          description: 'Please upgrade your plan to create more ICPs'
        });
      } else {
        toast.error(error.message || 'Failed to create ICP');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldWithAI = (
    fieldName: keyof ICPFormData,
    label: string,
    placeholder: string,
    helpText: string,
    isTextarea: boolean = false
  ) => {
    const isAIField = aiFields.has(fieldName);
    const Component = isTextarea ? Textarea : Input;
    const currentLength = formData[fieldName].length;
    const maxLength = ICP_FIELD_LIMITS[fieldName];

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={fieldName} className="text-sm font-medium text-orange-300">
            {label}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAIField(fieldName)}
                  className={`h-6 px-2 ${isAIField ? 'text-yellow-400 hover:text-white' : 'text-gray-400 hover:text-white'} hover:bg-orange-500/20 transition-colors`}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {isAIField ? 'AI Will Generate' : 'Fill With AI'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {isAIField ? (
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
            <span className="text-sm text-orange-300">AI will generate this field</span>
          </div>
        ) : (
          <>
            <Component
              id={fieldName}
              placeholder={placeholder}
              value={formData[fieldName]}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              rows={isTextarea ? 3 : undefined}
              className="bg-gray-800/50 border-gray-700 focus:border-orange-500 text-white placeholder:text-gray-500"
              maxLength={maxLength}
            />
            {maxLength && (
              <div className="text-xs text-gray-500 text-right">
                {currentLength}/{maxLength} characters
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Create New ICP
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-400 mt-1">
              Define your Ideal Customer Profile with AI assistance to target the right prospects
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Create Tab Only (Upload removed for now until n8n workflow supports it) */}
            <div className="space-y-4">
              {/* Required Fields */}
              <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Required Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="icp_title" className="text-sm font-medium text-orange-300">
                        ICP Title <span className="text-red-400">*</span>
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleAIField('icp_title')}
                              className={`h-6 px-2 ${aiFields.has('icp_title') ? 'text-yellow-400 hover:text-white' : 'text-gray-400 hover:text-white'} hover:bg-orange-500/20 transition-colors`}
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              {aiFields.has('icp_title') ? 'AI Will Generate' : 'Fill With AI'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">AI will create a descriptive title based on your inputs</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {aiFields.has('icp_title') ? (
                      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
                        <span className="text-sm text-orange-300">AI will generate title</span>
                      </div>
                    ) : (
                      <>
                        <Input
                          id="icp_title"
                          placeholder="e.g., Fortune 500 CTOs"
                          value={formData.icp_title}
                          onChange={(e) => handleFieldChange('icp_title', e.target.value)}
                          className="bg-gray-800/50 border-gray-700 focus:border-orange-500 text-white"
                          maxLength={ICP_FIELD_LIMITS.icp_title}
                        />
                        <div className="text-xs text-gray-500 text-right">
                          {formData.icp_title.length}/{ICP_FIELD_LIMITS.icp_title} characters
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product_id" className="text-sm font-medium text-orange-300">
                      Product <span className="text-red-400">*</span>
                    </Label>
                    <Select
                      value={formData.product_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, product_id: value }))}
                    >
                      <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.length > 0 ? (
                          products.map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No products found - Add products to Knowledge Base first
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {products.length === 0 && (
                      <p className="text-xs text-yellow-400">
                        Tip: Go to Knowledge Base and add a Product entry first
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_company_maturity" className="text-sm font-medium text-orange-300">
                    Target Company Maturity <span className="text-red-400">*</span>
                  </Label>
                  <Select
                    value={formData.target_company_maturity}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, target_company_maturity: value }))}
                  >
                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                      <SelectValue placeholder="Select maturity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="startup">Startup (0-2 years)</SelectItem>
                      <SelectItem value="growth">Growth (2-5 years)</SelectItem>
                      <SelectItem value="established">Established (5-10 years)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (10+ years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Strategic Fields with AI Option */}
              <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                <div>
                  <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" />
                    Strategic Insights (AI-Powered)
                  </h3>
                  <p className="text-xs text-gray-400">
                    We will analyse your responses, alongside your product data, using AI to generate your Ideal Customer Profile. 
                    Creating your first ICP? Select 'Fill With AI' for full AI support using the data you have already provided.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderFieldWithAI(
                    'buying_triggers',
                    'Buying Triggers',
                    'e.g., Rapid growth, new regulations, digital transformation',
                    'AI will identify events that make them actively look for solutions',
                    true
                  )}

                  {renderFieldWithAI(
                    'champion_profile',
                    'Champion Profile',
                    'e.g., Progressive IT leader, Innovation-focused VP',
                    'AI will describe who inside the company will champion your solution',
                    true
                  )}

                  {renderFieldWithAI(
                    'decision_criteria',
                    'Decision Criteria',
                    'e.g., ROI, ease of integration, vendor stability',
                    'AI will identify their top priorities when evaluating solutions',
                    true
                  )}

                  {renderFieldWithAI(
                    'objection_patterns',
                    'Objection Patterns',
                    'e.g., Budget constraints, change resistance',
                    'AI will predict common concerns that stop them from buying',
                    true
                  )}

                  {renderFieldWithAI(
                    'success_metrics',
                    'Success Metrics',
                    'e.g., Time saved, revenue increase, cost reduction',
                    'AI will determine how they measure success',
                    true
                  )}

                  {renderFieldWithAI(
                    'engagement_preference',
                    'Engagement Preference',
                    'e.g., Data-driven pitch, peer referrals, case studies',
                    'AI will identify how they prefer to be approached',
                    true
                  )}

                  {renderFieldWithAI(
                    'budget_authority',
                    'Budget Authority',
                    'e.g., CFO approval needed, departmental budget',
                    'AI will identify who controls budget and decision process',
                    true
                  )}

                  {renderFieldWithAI(
                    'competitive_alternatives',
                    'Competitive Alternatives',
                    'e.g., Build in-house, competitor products, status quo',
                    'AI will identify what alternatives they consider',
                    true
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-gray-600 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.product_id || (!formData.icp_title && !aiFields.has('icp_title')) || !formData.target_company_maturity}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating ICP...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create ICP
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ICPCreationModalV2;
