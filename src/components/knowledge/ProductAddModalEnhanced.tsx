// src/components/knowledge/ProductAddModalEnhanced.tsx

import { Package, Building, Sparkles, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useModalFlow } from '@/components/modals/ModalFlowManager';

interface ProductAddModalEnhancedProps {
  newEntry: any;
  setNewEntry: (entry: any) => void;
  knowledgeTypes: any[];
  canAddAdditionalLinks: boolean;
  getMaxAdditionalLinks: () => number;
  subscription: any;
  addAdditionalLink: () => void;
  removeAdditionalLink: (id: string) => void;
  updateAdditionalLink: (id: string, field: 'title' | 'url', value: string) => void;
  aiFields: Set<string>;
  toggleAIField: (field: string) => void;
  handleAddEntry: () => void;
  isProcessing?: boolean;
}

// Character limit for URL
const MAX_URL_LENGTH = 250;

export const ProductAddModalEnhanced = ({
  newEntry,
  setNewEntry,
  knowledgeTypes,
  canAddAdditionalLinks,
  getMaxAdditionalLinks,
  subscription,
  addAdditionalLink,
  removeAdditionalLink,
  updateAdditionalLink,
  aiFields,
  toggleAIField,
  handleAddEntry,
  isProcessing = false
}: ProductAddModalEnhancedProps) => {

  // Get navigation functions from modal flow context
  const {
    closeModal,
    isAnyModalOpen
  } = useModalFlow();

  // Check if this modal is actually open
  const isModalOpen = isAnyModalOpen();

  // Simplified type - just Product or Service
  const entryTypeLabel = newEntry.knowledge_type === 'service' ? 'Service' : 'Product';

  // If modal is not open via ModalFlowManager, don't render
  if (!isModalOpen) return null;

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="p-1">
        {/* Processing indicator */}
        {isProcessing && (
          <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
            <span className="text-sm text-orange-300">AI is processing your entry. This may take a few moments...</span>
          </div>
        )}

        {/* Body */}
        <div className="space-y-6">
          {/* Type Selection */}
          <div className="mb-6">
            <Label className="text-sm font-medium text-orange-300 mb-2 block">
              Type <span className="text-red-400">*</span>
            </Label>
            <Select
              value={newEntry.knowledge_type || 'product'}
              onValueChange={(value) => setNewEntry({...newEntry, knowledge_type: value})}
              disabled={isProcessing}
            >
              <SelectTrigger className="bg-black/50 border-white/10 text-white hover:border-orange-500/50
                                        focus:border-orange-500 transition-all duration-300 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f36] border-white/10 rounded-xl">
                <SelectItem value="product" className="text-white hover:bg-white/10 focus:bg-white/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Product
                  </div>
                </SelectItem>
                <SelectItem value="service" className="text-white hover:bg-white/10 focus:bg-white/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Service
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* URL Input */}
          <div className="rounded-2xl p-6 bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-medium text-orange-300">
                  {entryTypeLabel} URL
                </h3>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-orange-300">
                  {entryTypeLabel} Link <span className="text-red-400">*</span>
                </Label>
                <Input
                  placeholder={`https://your-${newEntry.knowledge_type || 'product'}.com`}
                  value={newEntry.productLink || ''}
                  onChange={(e) => setNewEntry({...newEntry, productLink: e.target.value})}
                  maxLength={MAX_URL_LENGTH}
                  disabled={isProcessing}
                  className="bg-black/30 border-white/10 focus:border-orange-500/50 text-white
                             placeholder:text-gray-500 disabled:opacity-50 rounded-xl transition-all duration-300
                             focus:shadow-[0_0_0_3px_rgba(251,174,28,0.1)]"
                />
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <Sparkles className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-orange-300/90">
                    AI will analyse this URL and automatically generate the title, description, and target market for your {entryTypeLabel.toLowerCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 mt-6
                        bg-gradient-to-t from-black/20 to-transparent">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={isProcessing}
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10
                         hover:border-orange-500 transition-all duration-300 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddEntry}
              disabled={isProcessing || !newEntry.productLink}
              className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700
                         hover:to-amber-700 text-white disabled:opacity-50 rounded-lg
                         shadow-lg hover:shadow-orange-500/25 transition-all duration-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Add & Generate with AI
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
