// src/components/knowledge/ProductAddModalEnhanced.tsx

import { Package, Building, FileText, Sparkles, X, Info, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ProductAddModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigate?: { prev: boolean; next: boolean };
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

// Character limits
const CHAR_LIMITS = {
  title: 80,
  productLink: 250,
  infoLink: 250,
  targetMarket: 300,
  content: 800,
  keyStatistics: 500
};

export const ProductAddModalEnhanced = ({
  isOpen,
  onClose,
  onNavigate,
  canNavigate,
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

  const hasProductLink = newEntry.productLink && newEntry.productLink.trim() !== '';
  
  // Simplified type - just Product or Service
  const entryTypeLabel = newEntry.knowledge_type === 'service' ? 'Service' : 'Product';
  
  const renderAIField = (
    fieldName: string,
    label: string,
    placeholder: string,
    isTextarea: boolean = false,
    maxLength?: number,
    isRequired: boolean = false
  ) => {
    const Component = isTextarea ? Textarea : Input;
    const isAIEnabled = aiFields.has(fieldName);
    const canUseAI = hasProductLink;
    const currentLength = newEntry[fieldName]?.length || 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-orange-300">
            {label} {isRequired && <span className="text-red-400">*</span>}
          </Label>
          {canUseAI && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleAIField(fieldName)}
              disabled={isProcessing}
              className={cn(
                "text-xs flex items-center gap-1 transition-colors",
                isAIEnabled 
                  ? "text-orange-400 hover:text-orange-300" 
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              <Sparkles className="w-3 h-3" />
              Fill With AI
            </Button>
          )}
        </div>
        
        {isAIEnabled && canUseAI ? (
          <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
            <span className="text-sm text-orange-300">AI will generate this field</span>
          </div>
        ) : (
          <>
            <Component
              placeholder={placeholder}
              value={newEntry[fieldName] || ''}
              onChange={(e) => setNewEntry({...newEntry, [fieldName]: e.target.value})}
              rows={isTextarea ? (fieldName === 'content' ? 4 : 3) : undefined}
              maxLength={maxLength}
              disabled={isProcessing}
              className="bg-black/30 border-white/10 focus:border-orange-500/50 text-white placeholder:text-gray-500 
                         disabled:opacity-50 rounded-xl transition-all duration-300 resize-none
                         focus:shadow-[0_0_0_3px_rgba(251,174,28,0.1)]"
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
    <Dialog open={isOpen} onOpenChange={!isProcessing ? onClose : undefined}>
      <DialogContent className="max-w-[72rem] max-h-[90vh] p-0 bg-transparent border-0 overflow-hidden">
        {/* Navigation Arrows */}
        {onNavigate && canNavigate && (
          <>
            <button
              onClick={() => onNavigate('prev')}
              disabled={!canNavigate.prev}
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12",
                "rounded-full flex items-center justify-center transition-all duration-300",
                canNavigate.prev 
                  ? "hover:scale-110 cursor-pointer" 
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="w-8 h-8 text-white/90 drop-shadow-lg hover:text-orange-400" />
            </button>
            
            <button
              onClick={() => onNavigate('next')}
              disabled={!canNavigate.next}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12",
                "rounded-full flex items-center justify-center transition-all duration-300",
                canNavigate.next 
                  ? "hover:scale-110 cursor-pointer" 
                  : "opacity-30 cursor-not-allowed"
              )}
            >
              <ChevronRight className="w-8 h-8 text-white/90 drop-shadow-lg hover:text-orange-400" />
            </button>
          </>
        )}
  
        {/* Glass Effect Container */}
        <div className="relative w-full h-full flex flex-col">
          <div className="bg-gradient-to-br from-[#0A0E1B]/95 to-[#1A1F36]/95 backdrop-blur-xl rounded-3xl 
                          border border-white/10 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300 flex flex-col">
            
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-white/10 
                            bg-gradient-to-b from-black/20 to-transparent">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="absolute top-4 right-6 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 
                           flex items-center justify-center transition-all duration-300 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
              
              <h2 className="text-xl font-bold text-white">Add Knowledge Entry</h2>
              <p className="text-sm text-gray-400 mt-1">
                {isProcessing 
                  ? "AI is processing your entry. This may take a few moments..."
                  : "Provide a URL and Cold AI will analyse the page to create comprehensive content for outreach personalisation."
                }
              </p>
            </div>
  
            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6
                            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-orange-500/30">
              
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
  
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Required Information */}
                <div>
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-white/5 to-white/[0.02] 
                                  border border-white/10">
                    <h3 className="text-sm font-medium text-orange-300 mb-4 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Required Information
                    </h3>
                    
                    {/* Product/Service Link */}
                    <div className="space-y-2 mb-4">
                      <Label className="text-sm font-medium text-orange-300">
                        {entryTypeLabel} Link <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        placeholder={`https://your-${newEntry.knowledge_type || 'product'}.com`}
                        value={newEntry.productLink || ''}
                        onChange={(e) => setNewEntry({...newEntry, productLink: e.target.value})}
                        maxLength={CHAR_LIMITS.productLink}
                        disabled={isProcessing}
                        className="bg-black/30 border-white/10 focus:border-orange-500/50 text-white 
                                   placeholder:text-gray-500 disabled:opacity-50 rounded-xl transition-all duration-300
                                   focus:shadow-[0_0_0_3px_rgba(251,174,28,0.1)]"
                      />
                      <p className="text-xs text-gray-500">Cold AI will analyse this page</p>
                    </div>
                    
                    {/* Product/Service Name */}
                    {renderAIField(
                      'title',
                      `${entryTypeLabel} Name`,
                      'Will be extracted from URL',
                      false,
                      CHAR_LIMITS.title
                    )}
                  </div>
                </div>
                
                {/* Right Column - Strategic Insights */}
                <div>
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-white/5 to-white/[0.02] 
                                  border border-white/10">
                    <h3 className="text-sm font-medium text-amber-400 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Strategic Insights
                    </h3>
                    
                    {renderAIField(
                      'targetMarket',
                      'Target Market',
                      'AI will identify your ideal customers',
                      true,
                      CHAR_LIMITS.targetMarket
                    )}
                    
                    <div className="mt-4">
                      {renderAIField(
                        'content',
                        'Description',
                        'AI will create a detailed description',
                        true,
                        CHAR_LIMITS.content
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Additional Links (Premium) */}
              {canAddAdditionalLinks && newEntry.additionalLinks?.length > 0 && (
                <div className="mt-6 rounded-2xl p-4 bg-gradient-to-br from-white/5 to-white/[0.02] 
                                border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-300">Additional Resources</h3>
                    {newEntry.additionalLinks.length < getMaxAdditionalLinks() && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addAdditionalLink}
                        disabled={isProcessing}
                        className="text-xs border-white/20 hover:bg-white/10 text-gray-300"
                      >
                        Add Link
                      </Button>
                    )}
                  </div>
                  
                  {newEntry.additionalLinks.map((link: any) => (
                    <div key={link.id} className="flex gap-2 mb-2">
                      <Input
                        placeholder="Link title"
                        value={link.title}
                        onChange={(e) => updateAdditionalLink(link.id, 'title', e.target.value)}
                        disabled={isProcessing}
                        className="bg-black/30 border-white/10 text-white placeholder:text-gray-500 rounded-xl"
                      />
                      <Input
                        placeholder="URL"
                        value={link.url}
                        onChange={(e) => updateAdditionalLink(link.id, 'url', e.target.value)}
                        disabled={isProcessing}
                        className="bg-black/30 border-white/10 text-white placeholder:text-gray-500 rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAdditionalLink(link.id)}
                        disabled={isProcessing}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
  
            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 
                            bg-gradient-to-t from-black/20 to-transparent">
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline"
                  onClick={onClose}
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
                    'Add Entry'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
