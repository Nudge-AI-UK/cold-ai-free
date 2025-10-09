import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, Building, FileText, Calendar, Link as LinkIcon, BarChart, Target, TrendingUp, Users, DollarSign, AlertTriangle, Zap, Info, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { BaseModal } from '@/components/modals/BaseModal';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useModalFlow } from '@/components/modals/ModalFlowManager';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

// Field limits configuration (matching AI output structure)
const FIELD_LIMITS = {
  // Core fields
  title: { type: 'text' as const, limit: 80 },
  summary: { type: 'textarea' as const, limit: 200 },

  // Problem Solved section
  problem_text: { type: 'textarea' as const, limit: 500 },
  pain_points: { type: 'array' as const, limit: 8 },

  // Solution section
  solution_text: { type: 'textarea' as const, limit: 500 },
  key_features: { type: 'array' as const, limit: 10 },

  // Target Buyer section
  target_buyer_text: { type: 'textarea' as const, limit: 500 },
  ideal_titles: { type: 'array' as const, limit: 8 },
  industries: { type: 'array' as const, limit: 8 },

  // Sales Intelligence section
  hook_angles: { type: 'array' as const, limit: 5 },
  qualifying_questions: { type: 'array' as const, limit: 5 },
  elevator_pitch: { type: 'textarea' as const, limit: 300 }
};

interface KnowledgeDetailsModalProps {
  entry: {
    id: string;
    title: string;
    content: string;
    knowledge_type: string;
    metadata?: any;
    workflow_status?: string;
    review_status?: string;
    created_at: string;
    updated_at: string;
    created_by?: string;
  } | null;
}

// Helper function to ensure URLs have proper protocol
const ensureProtocol = (url: string): string => {
  if (!url) return url;
  // Check if URL already has a protocol
  if (url.match(/^https?:\/\//)) {
    return url;
  }
  // Add https:// by default
  return `https://${url}`;
};

// Helper function to safely format dates
const safeFormatDate = (dateString: string, formatPattern: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, formatPattern);
  } catch {
    return 'N/A';
  }
};

// Helper to parse markdown into structured data
const parseMarkdownToStructuredData = (content: string) => {
  const lines = content.split('\n');
  const data: any = {
    problem_text: '',
    pain_points: [],
    solution_text: '',
    key_features: [],
    target_buyer_text: '',
    ideal_titles: [],
    industries: [],
    hook_angles: [],
    qualifying_questions: [],
    elevator_pitch: ''
  };

  let currentSection = '';
  let currentSubsection = '';
  let textBuffer: string[] = [];

  const saveTextBuffer = () => {
    if (textBuffer.length > 0 && currentSection) {
      const text = textBuffer.join('\n').trim();
      if (currentSection === 'problem_solved') data.problem_text = text;
      else if (currentSection === 'solution') data.solution_text = text;
      else if (currentSection === 'target_buyer') data.target_buyer_text = text;
      else if (currentSection === 'sales_intelligence' && currentSubsection === 'elevator_pitch') {
        // Remove the quote markers and "Elevator Pitch:" label
        data.elevator_pitch = text.replace(/^>?\s*"?/, '').replace(/"?\s*$/, '').replace(/^Elevator Pitch:\s*/i, '');
      }
      textBuffer = [];
    }
  };

  for (const line of lines) {
    // Main section header (##)
    if (line.startsWith('## ')) {
      saveTextBuffer();
      const title = line.replace(/^##\s*/, '').trim();
      currentSection = title.toLowerCase().replace(/\s+/g, '_');
      currentSubsection = '';
    }
    // Subsection header (###)
    else if (line.startsWith('### ')) {
      saveTextBuffer();
      const title = line.replace(/^###\s*/, '').trim();
      currentSubsection = title.toLowerCase().replace(/\s+/g, '_').replace(/:$/,'');
    }
    // Bold subsection (**text:** format - e.g., **Ideal Titles:** or **Industries:**)
    // Check if line contains ** at start and : at end (may have closing **)
    else if (line.trim().startsWith('**') && line.trim().includes(':')) {
      saveTextBuffer();
      // Remove all asterisks and colons to get clean title
      let title = line.trim()
        .replace(/^\*\*/, '')      // Remove opening **
        .replace(/:\*\*$/, '')     // Remove closing :** if present
        .replace(/:$/, '')         // Remove trailing :
        .replace(/\*\*$/, '')      // Remove closing ** if present
        .trim();

      // Remove any remaining colons and convert to key format
      currentSubsection = title.toLowerCase().replace(/:/g, '').replace(/\s+/g, '_');
    }
    // Bullet point - handle all sections
    else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
      const item = line.trim().replace(/^[-•]\s*/, '').trim();
      if (!item) continue;

      if (currentSection === 'problem_solved' && currentSubsection === 'pain_points') {
        data.pain_points.push(item);
      } else if (currentSection === 'solution' && currentSubsection === 'key_features') {
        data.key_features.push(item);
      } else if (currentSection === 'target_buyer') {
        if (currentSubsection === 'ideal_titles') {
          data.ideal_titles.push(item);
        } else if (currentSubsection === 'industries') {
          data.industries.push(item);
        }
      } else if (currentSection === 'sales_intelligence') {
        if (currentSubsection === 'hook_angles') data.hook_angles.push(item);
        else if (currentSubsection === 'qualifying_questions') data.qualifying_questions.push(item);
      }
    }
    // Regular text
    else if (line.trim() && !line.startsWith('#')) {
      textBuffer.push(line);
    }
  }

  saveTextBuffer();

  return data;
};

// Helper function to render parsed section with appropriate icon and formatting
const renderSection = (sectionKey: string, content: string) => {
  // Skip empty sections
  if (!content || content === 'undefined' || content === 'null') return null;

  // Map section keys to display names and icons
  const sectionMap: Record<string, { title: string; icon: any; color: string }> = {
    'problem_solved': { title: 'Problem Solved', icon: AlertTriangle, color: 'text-red-400' },
    'pain_points': { title: 'Pain Points', icon: AlertTriangle, color: 'text-orange-400' },
    'solution': { title: 'Solution', icon: Zap, color: 'text-green-400' },
    'key_features': { title: 'Key Features', icon: Package, color: 'text-blue-400' },
    'target_buyer': { title: 'Target Buyer', icon: Target, color: 'text-purple-400' },
    'ideal_titles': { title: 'Ideal Titles', icon: Users, color: 'text-indigo-400' },
    'industries': { title: 'Industries', icon: Building, color: 'text-cyan-400' },
    'sales_intelligence': { title: 'Sales Intelligence', icon: TrendingUp, color: 'text-yellow-400' },
    'hook_angles': { title: 'Hook Angles', icon: BarChart, color: 'text-pink-400' },
    'pricing': { title: 'Pricing', icon: DollarSign, color: 'text-emerald-400' }
  };

  const sectionInfo = sectionMap[sectionKey] || {
    title: sectionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    icon: FileText,
    color: 'text-gray-400'
  };

  const Icon = sectionInfo.icon;

  // Format content: handle bullet points and special markers
  const formatContent = (text: string) => {
    // Remove leading dashes and asterisks, convert to proper bullet points
    return text
      .split('\n')
      .map(line => {
        // Handle lines starting with - or *
        if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
          return '• ' + line.trim().substring(1).trim();
        }
        // Handle lines with ** markers (bold text indicators)
        if (line.includes('**')) {
          const parts = line.split('**');
          return parts.map((part, i) => i % 2 === 1 ? part : part).join('');
        }
        return line;
      })
      .join('\n');
  };

  return (
    <div key={sectionKey} className="space-y-2">
      <h3 className={`text-sm font-medium ${sectionInfo.color} flex items-center gap-2`}>
        <Icon className="w-4 h-4" />
        {sectionInfo.title}
      </h3>
      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
        {formatContent(content)}
      </p>
    </div>
  );
};

// Simple markdown section parser for view mode
const parseMarkdownSections = (content: string) => {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');
  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check for main section headers (##)
    if (line.trim().startsWith('##')) {
      // Save previous section
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      // Start new section
      currentSection = line.trim()
        .replace(/^##\s*/, '')
        .toLowerCase()
        .replace(/\s+/g, '_');
      currentContent = [];
    } else {
      // Add content to current section
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
};

export const KnowledgeDetailsModal = ({ entry }: KnowledgeDetailsModalProps) => {
  const { closeModal } = useModalFlow();
  const { user } = useAuth();

  // Guard clause - return null if entry is not available
  if (!entry) {
    return null;
  }

  // Check if in draft/pending mode (editable)
  const isDraftPending = entry.workflow_status === 'draft' && entry.review_status === 'pending';

  // State for editing
  const [isEditing, setIsEditing] = useState(isDraftPending);
  const [editedTitle, setEditedTitle] = useState(entry.title || '');
  const [editedSummary, setEditedSummary] = useState(entry.summary || '');
  const [isSaving, setIsSaving] = useState(false);

  // Parse content into structured data (for both draft and active modes)
  const [formData, setFormData] = useState(() => {
    if (entry.content) {
      return parseMarkdownToStructuredData(entry.content);
    }
    return {
      problem_text: '',
      pain_points: [],
      solution_text: '',
      key_features: [],
      target_buyer_text: '',
      ideal_titles: [],
      industries: [],
      hook_angles: [],
      qualifying_questions: [],
      elevator_pitch: ''
    };
  });

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    const fieldLimit = FIELD_LIMITS[field as keyof typeof FIELD_LIMITS];
    if (fieldLimit && (fieldLimit.type === 'text' || fieldLimit.type === 'textarea')) {
      if (value.length > fieldLimit.limit) {
        return; // Don't update if over limit
      }
    }

    setFormData({ ...formData, [field]: value });
  };

  // Handle array field changes
  const handleArrayFieldAdd = (field: string, value: string) => {
    if (!value.trim()) return;

    const currentArray = formData[field] || [];
    const fieldLimit = FIELD_LIMITS[field as keyof typeof FIELD_LIMITS];

    if (fieldLimit && fieldLimit.type === 'array' && currentArray.length >= fieldLimit.limit) {
      return; // Don't add if at limit
    }

    setFormData({
      ...formData,
      [field]: [...currentArray, value.trim()]
    });
  };

  const handleArrayFieldRemove = (field: string, index: number) => {
    const currentArray = formData[field] || [];
    setFormData({
      ...formData,
      [field]: currentArray.filter((_: any, i: number) => i !== index)
    });
  };

  // Get character count color
  const getCharCountColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 70) return 'text-yellow-400';
    return 'text-gray-400';
  };

  // Reconstruct markdown from structured data
  const reconstructMarkdown = () => {
    let markdown = '';

    // Problem Solved section
    if (formData.problem_text || formData.pain_points.length > 0) {
      markdown += `## Problem Solved\n${formData.problem_text}\n\n`;
      if (formData.pain_points.length > 0) {
        markdown += `### Pain Points:\n`;
        formData.pain_points.forEach((point: string) => {
          markdown += `- ${point}\n`;
        });
        markdown += '\n';
      }
    }

    // Solution section
    if (formData.solution_text || formData.key_features.length > 0) {
      markdown += `## Solution\n${formData.solution_text}\n\n`;
      if (formData.key_features.length > 0) {
        markdown += `### Key Features:\n`;
        formData.key_features.forEach((feature: string) => {
          markdown += `- ${feature}\n`;
        });
        markdown += '\n';
      }
    }

    // Target Buyer section
    if (formData.target_buyer_text || formData.ideal_titles.length > 0 || formData.industries.length > 0) {
      markdown += `## Target Buyer\n${formData.target_buyer_text}\n\n`;
      if (formData.ideal_titles.length > 0) {
        markdown += `**Ideal Titles:**\n`;
        formData.ideal_titles.forEach((title: string) => {
          markdown += `  • ${title}\n`;
        });
        markdown += '\n';
      }
      if (formData.industries.length > 0) {
        markdown += `**Industries:**\n`;
        formData.industries.forEach((industry: string) => {
          markdown += `  • ${industry}\n`;
        });
        markdown += '\n';
      }
    }

    // Sales Intelligence section
    if (formData.hook_angles.length > 0 || formData.qualifying_questions.length > 0 || formData.elevator_pitch) {
      markdown += `## Sales Intelligence\n\n`;
      if (formData.hook_angles.length > 0) {
        markdown += `### Hook Angles:\n`;
        formData.hook_angles.forEach((angle: string) => {
          markdown += `- ${angle}\n`;
        });
        markdown += '\n';
      }
      if (formData.qualifying_questions.length > 0) {
        markdown += `### Qualifying Questions:\n`;
        formData.qualifying_questions.forEach((q: string) => {
          markdown += `- ${q}\n`;
        });
        markdown += '\n';
      }
      if (formData.elevator_pitch) {
        markdown += `### Elevator Pitch:\n> "${formData.elevator_pitch}"\n`;
      }
    }

    return markdown.trim();
  };

  // Handle approve & submit
  const handleApprove = async () => {
    if (!user) {
      toast.error('You must be logged in to approve entries');
      return;
    }

    setIsSaving(true);
    try {
      const reconstructedContent = reconstructMarkdown();

      console.log('Approving entry with data:', {
        title: editedTitle,
        summary: editedSummary,
        contentLength: reconstructedContent.length,
        contentPreview: reconstructedContent.substring(0, 100)
      });

      // Use n8nService to trigger the approval workflow
      const { n8nService } = await import('@/services/n8nService');
      const result = await n8nService.approveEntry(
        entry.id,
        user.id,
        undefined, // no review notes for now
        {
          title: editedTitle,
          summary: editedSummary,
          content: reconstructedContent,
          knowledge_type: entry.knowledge_type,
          // Don't pass metadata to avoid double-stringification issues
          // The edge function will preserve existing metadata
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to approve entry');
      }

      toast.success('Product approved! AI is now reviewing your changes...');

      // Reload page to show reviewing widget state
      // The widget will poll until workflow_status becomes 'active'
      window.location.reload();
    } catch (error) {
      console.error('Error approving entry:', error);
      toast.error('Failed to approve product');
      setIsSaving(false);
    }
  };

  // Handle save draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const reconstructedContent = reconstructMarkdown();
      const { error } = await supabase
        .from('knowledge_base')
        .update({
          title: editedTitle,
          summary: editedSummary,
          content: reconstructedContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id);

      if (error) throw error;

      toast.success('Draft saved successfully');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reject/delete
  const handleReject = async () => {
    if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      toast.success('Entry deleted successfully');

      // Refresh page to show empty state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    } finally {
      setIsSaving(false);
    }
  };

  const getTypeInfo = () => {
    switch (entry.knowledge_type) {
      case 'product':
        return { icon: Package, color: 'bg-orange-500/20 text-orange-300', label: 'Product/Service' };
      case 'company':
        return { icon: Building, color: 'bg-blue-500/20 text-blue-300', label: 'Company Info' };
      case 'case_study':
        return { icon: FileText, color: 'bg-green-500/20 text-green-300', label: 'Case Study' };
      default:
        return { icon: FileText, color: 'bg-gray-500/20 text-gray-300', label: 'Document' };
    }
  };

  const typeInfo = getTypeInfo();
  const TypeIcon = typeInfo.icon;

  // Check if entry is live/active and has markdown content
  const isLive = entry.review_status === 'approved' || entry.workflow_status === 'active';
  const hasMarkdownContent = entry.content && entry.content.includes('##');

  // Parse markdown content if it's a live entry with markdown
  const parsedSections = isLive && hasMarkdownContent ? parseMarkdownSections(entry.content) : {};
  const hasParsedSections = Object.keys(parsedSections).length > 0;

  // Extract metadata fields with safe fallbacks
  const metadata = entry.metadata || {};
  const qualityAssessment = metadata.quality_assessment || {};
  const sourceInfo = metadata.source_info || {};
  const workflowMetadata = metadata.workflow_metadata || {};

  // Use top-level summary field (not metadata.summary)
  const summaryContent = entry.summary || metadata.summary;

  // Format research URL - check multiple possible locations
  const researchUrl = workflowMetadata.research_url ||
                      sourceInfo.research_url ||
                      sourceInfo.url ||
                      sourceInfo.original_url ||
                      metadata.productLink ||
                      metadata.product_link ||
                      metadata.url ||
                      metadata.link ||
                      '';
  const displayUrl = researchUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');

  // Format keywords
  const keywords = workflowMetadata.keywords || [];

  // Debug logging for source info
  console.log('🔍 Source Info Debug:', {
    metadata,
    sourceInfo,
    workflowMetadata,
    researchUrl,
    displayUrl,
    isLive,
    hasQualityAssessment: !!qualityAssessment.completeness,
    hasGeneratedAt: !!sourceInfo.generated_at,
    hasKeywords: keywords.length > 0
  });

  // Section order for consistent display (matches n8n markdown generation)
  const sectionOrder = [
    'problem_solved',
    'solution',
    'target_buyer',
    'sales_intelligence'
  ];

  return (
    <BaseModal
      title={isDraftPending ? 'Review & Edit Product' : (entry.title ? entry.title.replace(/^["']|["']$/g, '') : 'Knowledge Entry')}
      description={typeInfo.label}
      className="knowledge-modal-large !max-w-[95vw] !h-[90vh]"
    >
      <div className="flex h-full overflow-hidden">
        {/* Left Content Area */}
        <div className="flex-1 overflow-y-auto pr-6 space-y-6">
          {isDraftPending ? (
            /* EDITABLE FORM - Draft/Pending Mode */
            <div className="space-y-6">
              {/* Title - Full Width */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-orange-300 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Product Title
                  <span className={cn("ml-auto text-xs", getCharCountColor(editedTitle.length, FIELD_LIMITS.title.limit))}>
                    {editedTitle.length}/{FIELD_LIMITS.title.limit}
                  </span>
                </Label>
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  maxLength={FIELD_LIMITS.title.limit}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Product Name - Key Benefit"
                />
              </div>

              {/* Summary - Full Width */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-orange-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Summary
                  <span className={cn("ml-auto text-xs", getCharCountColor(editedSummary.length, FIELD_LIMITS.summary.limit))}>
                    {editedSummary.length}/{FIELD_LIMITS.summary.limit}
                  </span>
                </Label>
                <Textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  maxLength={FIELD_LIMITS.summary.limit}
                  rows={3}
                  className="bg-gray-800 border-gray-700 text-white resize-none"
                  placeholder="One powerful sentence describing what this product does and who it's for"
                />
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Problem Solved Section */}
              <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                <h3 className="text-md font-semibold text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Problem Solved
                </h3>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    Description
                    <span className={cn("ml-auto text-xs", getCharCountColor(formData.problem_text.length, FIELD_LIMITS.problem_text.limit))}>
                      {formData.problem_text.length}/{FIELD_LIMITS.problem_text.limit}
                    </span>
                  </Label>
                  <Textarea
                    value={formData.problem_text}
                    onChange={(e) => handleInputChange('problem_text', e.target.value)}
                    maxLength={FIELD_LIMITS.problem_text.limit}
                    rows={4}
                    className="bg-gray-800 border-gray-700 text-white resize-none"
                    placeholder="The specific problem this product solves"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    Pain Points
                    <span className="ml-auto text-xs text-gray-400">
                      {formData.pain_points.length}/{FIELD_LIMITS.pain_points.limit} items
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg bg-gray-900/50 border border-gray-700">
                    {formData.pain_points.map((point: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-gray-800 text-gray-300 border-gray-600"
                      >
                        {point}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 p-0 h-auto hover:bg-transparent"
                          onClick={() => handleArrayFieldRemove('pain_points', index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add pain point..."
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={formData.pain_points.length >= FIELD_LIMITS.pain_points.limit}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          handleArrayFieldAdd('pain_points', input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gray-800 border-gray-700"
                      disabled={formData.pain_points.length >= FIELD_LIMITS.pain_points.limit}
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add pain point..."]') as HTMLInputElement;
                        if (input && input.value) {
                          handleArrayFieldAdd('pain_points', input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Solution Section */}
              <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                <h3 className="text-md font-semibold text-green-400 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Solution
                </h3>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    Description
                    <span className={cn("ml-auto text-xs", getCharCountColor(formData.solution_text.length, FIELD_LIMITS.solution_text.limit))}>
                      {formData.solution_text.length}/{FIELD_LIMITS.solution_text.limit}
                    </span>
                  </Label>
                  <Textarea
                    value={formData.solution_text}
                    onChange={(e) => handleInputChange('solution_text', e.target.value)}
                    maxLength={FIELD_LIMITS.solution_text.limit}
                    rows={4}
                    className="bg-gray-800 border-gray-700 text-white resize-none"
                    placeholder="How the product solves the problem"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    Key Features
                    <span className="ml-auto text-xs text-gray-400">
                      {formData.key_features.length}/{FIELD_LIMITS.key_features.limit} items
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg bg-gray-900/50 border border-gray-700">
                    {formData.key_features.map((feature: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-gray-800 text-gray-300 border-gray-600"
                      >
                        {feature}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 p-0 h-auto hover:bg-transparent"
                          onClick={() => handleArrayFieldRemove('key_features', index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add feature + benefit..."
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={formData.key_features.length >= FIELD_LIMITS.key_features.limit}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          handleArrayFieldAdd('key_features', input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gray-800 border-gray-700"
                      disabled={formData.key_features.length >= FIELD_LIMITS.key_features.limit}
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add feature + benefit..."]') as HTMLInputElement;
                        if (input && input.value) {
                          handleArrayFieldAdd('key_features', input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
              {/* Target Buyer Section */}
              <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                <h3 className="text-md font-semibold text-purple-400 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Target Buyer
                </h3>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    Description
                    <span className={cn("ml-auto text-xs", getCharCountColor(formData.target_buyer_text.length, FIELD_LIMITS.target_buyer_text.limit))}>
                      {formData.target_buyer_text.length}/{FIELD_LIMITS.target_buyer_text.limit}
                    </span>
                  </Label>
                  <Textarea
                    value={formData.target_buyer_text}
                    onChange={(e) => handleInputChange('target_buyer_text', e.target.value)}
                    maxLength={FIELD_LIMITS.target_buyer_text.limit}
                    rows={4}
                    className="bg-gray-800 border-gray-700 text-white resize-none"
                    placeholder="Description of the ideal buyer"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Ideal Titles
                    <span className="ml-auto text-xs text-gray-400">
                      {formData.ideal_titles.length}/{FIELD_LIMITS.ideal_titles.limit} items
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg bg-gray-900/50 border border-gray-700">
                    {formData.ideal_titles.map((title: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-gray-800 text-gray-300 border-gray-600"
                      >
                        {title}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 p-0 h-auto hover:bg-transparent"
                          onClick={() => handleArrayFieldRemove('ideal_titles', index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add job title..."
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={formData.ideal_titles.length >= FIELD_LIMITS.ideal_titles.limit}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          handleArrayFieldAdd('ideal_titles', input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gray-800 border-gray-700"
                      disabled={formData.ideal_titles.length >= FIELD_LIMITS.ideal_titles.limit}
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add job title..."]') as HTMLInputElement;
                        if (input && input.value) {
                          handleArrayFieldAdd('ideal_titles', input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Industries
                    <span className="ml-auto text-xs text-gray-400">
                      {formData.industries.length}/{FIELD_LIMITS.industries.limit} items
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg bg-gray-900/50 border border-gray-700">
                    {formData.industries.map((industry: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-gray-800 text-gray-300 border-gray-600"
                      >
                        {industry}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 p-0 h-auto hover:bg-transparent"
                          onClick={() => handleArrayFieldRemove('industries', index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add industry..."
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={formData.industries.length >= FIELD_LIMITS.industries.limit}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          handleArrayFieldAdd('industries', input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gray-800 border-gray-700"
                      disabled={formData.industries.length >= FIELD_LIMITS.industries.limit}
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add industry..."]') as HTMLInputElement;
                        if (input && input.value) {
                          handleArrayFieldAdd('industries', input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sales Intelligence Section */}
              <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                <h3 className="text-md font-semibold text-yellow-400 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Sales Intelligence
                </h3>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    Hook Angles
                    <span className="ml-auto text-xs text-gray-400">
                      {formData.hook_angles.length}/{FIELD_LIMITS.hook_angles.limit} items
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg bg-gray-900/50 border border-gray-700">
                    {formData.hook_angles.map((angle: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-gray-800 text-gray-300 border-gray-600"
                      >
                        {angle}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 p-0 h-auto hover:bg-transparent"
                          onClick={() => handleArrayFieldRemove('hook_angles', index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add hook angle..."
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={formData.hook_angles.length >= FIELD_LIMITS.hook_angles.limit}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          handleArrayFieldAdd('hook_angles', input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gray-800 border-gray-700"
                      disabled={formData.hook_angles.length >= FIELD_LIMITS.hook_angles.limit}
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add hook angle..."]') as HTMLInputElement;
                        if (input && input.value) {
                          handleArrayFieldAdd('hook_angles', input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    Qualifying Questions
                    <span className="ml-auto text-xs text-gray-400">
                      {formData.qualifying_questions.length}/{FIELD_LIMITS.qualifying_questions.limit} items
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg bg-gray-900/50 border border-gray-700">
                    {formData.qualifying_questions.map((question: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-gray-800 text-gray-300 border-gray-600"
                      >
                        {question}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 p-0 h-auto hover:bg-transparent"
                          onClick={() => handleArrayFieldRemove('qualifying_questions', index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add qualifying question..."
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={formData.qualifying_questions.length >= FIELD_LIMITS.qualifying_questions.limit}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          handleArrayFieldAdd('qualifying_questions', input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gray-800 border-gray-700"
                      disabled={formData.qualifying_questions.length >= FIELD_LIMITS.qualifying_questions.limit}
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add qualifying question..."]') as HTMLInputElement;
                        if (input && input.value) {
                          handleArrayFieldAdd('qualifying_questions', input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-gray-300 flex items-center gap-2">
                    Elevator Pitch
                    <span className={cn("ml-auto text-xs", getCharCountColor(formData.elevator_pitch.length, FIELD_LIMITS.elevator_pitch.limit))}>
                      {formData.elevator_pitch.length}/{FIELD_LIMITS.elevator_pitch.limit}
                    </span>
                  </Label>
                  <Textarea
                    value={formData.elevator_pitch}
                    onChange={(e) => handleInputChange('elevator_pitch', e.target.value)}
                    maxLength={FIELD_LIMITS.elevator_pitch.limit}
                    rows={3}
                    className="bg-gray-800 border-gray-700 text-white resize-none"
                    placeholder="30-second pitch"
                  />
                </div>
              </div>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW MODE - Active/Approved */
            <div className="space-y-6">
              {/* Summary */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-orange-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Summary
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{editedSummary}</p>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Problem Solved Section */}
                  <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                    <h3 className="text-md font-semibold text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Problem Solved
                    </h3>

                    {formData.problem_text && (
                      <p className="text-gray-300 text-sm leading-relaxed">{formData.problem_text}</p>
                    )}

                    {formData.pain_points.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-400">Pain Points:</h4>
                        <ul className="space-y-1">
                          {formData.pain_points.map((point: string, index: number) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-red-400 mt-0.5">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Solution Section */}
                  <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                    <h3 className="text-md font-semibold text-green-400 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Solution
                    </h3>

                    {formData.solution_text && (
                      <p className="text-gray-300 text-sm leading-relaxed">{formData.solution_text}</p>
                    )}

                    {formData.key_features.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-400">Key Features:</h4>
                        <ul className="space-y-1">
                          {formData.key_features.map((feature: string, index: number) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">•</span>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Target Buyer Section */}
                  <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                    <h3 className="text-md font-semibold text-purple-400 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Target Buyer
                    </h3>

                    {formData.target_buyer_text && (
                      <p className="text-gray-300 text-sm leading-relaxed">{formData.target_buyer_text}</p>
                    )}

                    {formData.ideal_titles.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Ideal Titles:
                        </h4>
                        <ul className="space-y-1">
                          {formData.ideal_titles.map((title: string, index: number) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-purple-400 mt-0.5">•</span>
                              <span>{title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {formData.industries.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          Industries:
                        </h4>
                        <ul className="space-y-1">
                          {formData.industries.map((industry: string, index: number) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-purple-400 mt-0.5">•</span>
                              <span>{industry}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Sales Intelligence Section */}
                  <div className="space-y-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                    <h3 className="text-md font-semibold text-yellow-400 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Sales Intelligence
                    </h3>

                    {formData.hook_angles.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-400">Hook Angles:</h4>
                        <ul className="space-y-1">
                          {formData.hook_angles.map((angle: string, index: number) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-yellow-400 mt-0.5">•</span>
                              <span>{angle}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {formData.qualifying_questions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-400">Qualifying Questions:</h4>
                        <ul className="space-y-1">
                          {formData.qualifying_questions.map((question: string, index: number) => (
                            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-yellow-400 mt-0.5">•</span>
                              <span>{question}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {formData.elevator_pitch && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-400">Elevator Pitch:</h4>
                        <p className="text-sm text-gray-300 italic border-l-2 border-yellow-400 pl-3">
                          "{formData.elevator_pitch}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Links Section */}
          {(metadata.productLink || metadata.infoLink || metadata.additionalLinks?.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-orange-300 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Resources
              </h3>
              <div className="space-y-2">
                {metadata.productLink && (
                  <a
                    href={ensureProtocol(metadata.productLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    Product Link →
                  </a>
                )}
                {metadata.infoLink && (
                  <a
                    href={ensureProtocol(metadata.infoLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    More Information →
                  </a>
                )}
                {metadata.additionalLinks?.map((link: any, index: number) => (
                  <a
                    key={index}
                    href={ensureProtocol(link.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {link.title} →
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Created: {safeFormatDate(entry.created_at, 'dd MMM yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Updated: {safeFormatDate(entry.updated_at, 'dd MMM yyyy')}</span>
              </div>
            </div>
            {metadata.enhanced && (
              <Badge variant="outline" className="mt-3 bg-purple-500/20 text-purple-300 border-purple-500/30">
                AI Enhanced
              </Badge>
            )}
          </div>
        </div>

        {/* AI Summary Panel - Show for draft/pending and view modes */}
        {(isDraftPending || (isLive && (qualityAssessment.completeness || sourceInfo.generated_at || keywords.length > 0 || researchUrl))) && (
          <div className="w-96 border-l border-gray-700 bg-gray-900/50 overflow-y-auto p-6 space-y-4">
            {/* Header */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  AI Feedback
                </h3>
                {isDraftPending && (
                  <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                    Review Mode
                  </Badge>
                )}
              </div>
            </div>

            {/* AI Review Summary */}
            {qualityAssessment.ai_review_summary && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  AI Assessment
                </h4>
                <p className="text-sm text-gray-300 leading-relaxed">{qualityAssessment.ai_review_summary}</p>
              </div>
            )}

            {/* Quality Assessment Scores */}
            {(qualityAssessment.completeness || qualityAssessment.sales_readiness || qualityAssessment.overall_quality) && (
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-orange-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Quality Scores
                </h3>

                <div className="space-y-3">
                  {qualityAssessment.overall_quality && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Overall Quality</span>
                        <span className="text-white font-medium">{qualityAssessment.overall_quality}%</span>
                      </div>
                      <Progress value={qualityAssessment.overall_quality} className="h-2" />
                    </div>
                  )}

                  {qualityAssessment.completeness && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Completeness</span>
                        <span className="text-white font-medium">{qualityAssessment.completeness}%</span>
                      </div>
                      <Progress value={qualityAssessment.completeness} className="h-2" />
                    </div>
                  )}

                  {qualityAssessment.sales_readiness && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Sales Readiness</span>
                        <span className="text-white font-medium">{qualityAssessment.sales_readiness}%</span>
                      </div>
                      <Progress value={qualityAssessment.sales_readiness} className="h-2" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Missing Intel / Future Enhancements */}
            {(qualityAssessment.missing_intel?.length > 0 || qualityAssessment.future_enhancements?.length > 0) && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-yellow-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Areas for Improvement
                </h4>
                <ul className="space-y-2">
                  {(qualityAssessment.missing_intel || qualityAssessment.future_enhancements)?.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-yellow-400 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source Information */}
            {(researchUrl || sourceInfo.generated_at) && (
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium text-orange-300 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Source Information
                </h3>

                {researchUrl && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Product URL</p>
                    <a
                      href={researchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                    >
                      <LinkIcon className="w-3 h-3" />
                      {displayUrl}
                    </a>
                  </div>
                )}

                {sourceInfo.generated_at && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Generated</p>
                    <div className="flex items-center gap-1 text-sm text-gray-300">
                      <Calendar className="w-3 h-3" />
                      {safeFormatDate(sourceInfo.generated_at, 'dd/MM/yyyy')}
                    </div>
                  </div>
                )}

                {sourceInfo.ai_generation_count && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">AI Generation Count</p>
                    <p className="text-sm text-gray-300 font-medium">{sourceInfo.ai_generation_count}</p>
                  </div>
                )}
              </div>
            )}

            {/* Additional Information */}
            {(keywords.length > 0 || workflowMetadata.product_category) && (
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium text-orange-300 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Additional Information
                </h3>

                {keywords.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Keywords</p>
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((keyword: string, index: number) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs bg-gray-700/50 border-gray-600 text-gray-300"
                        >
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {workflowMetadata.product_category && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Product Category</p>
                    <p className="text-sm text-gray-300">{workflowMetadata.product_category}</p>
                  </div>
                )}

                {workflowMetadata.buying_urgency && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Buying Urgency</p>
                    <p className="text-sm text-gray-300 capitalize">{workflowMetadata.buying_urgency}</p>
                  </div>
                )}

                {workflowMetadata.typical_sales_cycle && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Typical Sales Cycle</p>
                    <p className="text-sm text-gray-300">{workflowMetadata.typical_sales_cycle}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons for Draft/Pending Mode */}
      {isDraftPending && (
        <div className="mt-6 pt-6 border-t border-gray-700 flex items-center justify-end">
          {/* TODO: Re-enable delete button with abuse prevention
          <button
            onClick={handleReject}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Entry
          </button>
          */}

          <button
            onClick={handleApprove}
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Approving...' : 'Approve & Submit'}
          </button>
        </div>
      )}
    </BaseModal>
  );
};