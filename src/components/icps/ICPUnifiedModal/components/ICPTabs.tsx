import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  X,
  Users,
  Target,
  Building,
  MessageSquare,
  Lightbulb,
  ChartBar,
  DollarSign,
  Globe,
  Briefcase,
  Settings,
  PenTool,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Field limits configuration
const FIELD_LIMITS: Record<string, { type: 'text' | 'textarea' | 'array'; limit: number }> = {
  // Text fields
  icp_name: { type: 'text', limit: 80 },
  company_size_range: { type: 'text', limit: 80 },
  budget_range: { type: 'text', limit: 80 },
  sales_cycle_length: { type: 'text', limit: 80 },
  geographic_focus: { type: 'text', limit: 100 },
  // Textarea fields
  description: { type: 'textarea', limit: 500 },
  company_characteristics: { type: 'textarea', limit: 800 },
  decision_making_process: { type: 'textarea', limit: 800 },
  call_to_action: { type: 'textarea', limit: 500 },
  market_trends: { type: 'textarea', limit: 1000 },
  competitive_landscape: { type: 'textarea', limit: 1000 },
  // Array fields
  job_titles: { type: 'array', limit: 10 },
  industry_focus: { type: 'array', limit: 10 },
  pain_points: { type: 'array', limit: 10 },
  value_drivers: { type: 'array', limit: 10 },
  technology_stack: { type: 'array', limit: 15 },
  preferred_communication_channels: { type: 'array', limit: 7 },
  objections_and_concerns: { type: 'array', limit: 10 },
  success_metrics: { type: 'array', limit: 10 },
  competitive_alternatives: { type: 'array', limit: 10 },
  buying_signals: { type: 'array', limit: 10 },
  key_messaging_points: { type: 'array', limit: 10 },
  growth_opportunities: { type: 'array', limit: 10 },
  risk_factors: { type: 'array', limit: 10 }
};

interface ICPTabsProps {
  tabs: Array<{ id: string; label: string; icon: any }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  formData: any;
  setFormData: (data: any) => void;
  isEditable: boolean;
  changedFields: string[];
  metadata?: any;
  mode: 'edit' | 'review' | 'view';
}

export const ICPTabs: React.FC<ICPTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  formData,
  setFormData,
  isEditable,
  changedFields,
  metadata,
  mode
}) => {
  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    if (!isEditable) return;
    
    // Check character limits for text/textarea fields
    const fieldLimit = FIELD_LIMITS[field];
    if (fieldLimit && (fieldLimit.type === 'text' || fieldLimit.type === 'textarea')) {
      if (value.length > fieldLimit.limit) {
        return; // Don't update if over limit
      }
    }
    
    setFormData({ ...formData, [field]: value });
  };

  // Handle array field changes (add/remove items)
  const handleArrayFieldAdd = (field: string, value: string) => {
    if (!isEditable || !value.trim()) return;
    
    const currentArray = formData[field] || [];
    const fieldLimit = FIELD_LIMITS[field];
    
    // Check array item limit
    if (fieldLimit && fieldLimit.type === 'array' && currentArray.length >= fieldLimit.limit) {
      return; // Don't add if at limit
    }
    
    setFormData({
      ...formData,
      [field]: [...currentArray, value.trim()]
    });
  };

  const handleArrayFieldRemove = (field: string, index: number) => {
    if (!isEditable) return;
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

  // Field renderer for both edit and view modes
  const renderField = (
    label: string,
    field: string,
    type: 'text' | 'textarea' | 'array' = 'text',
    placeholder?: string,
    icon?: React.ReactNode
  ) => {
    const hasChanged = changedFields.includes(field);
    const value = formData[field] || '';
    const fieldLimit = FIELD_LIMITS[field];
    const charLimit = fieldLimit && (fieldLimit.type === 'text' || fieldLimit.type === 'textarea') ? fieldLimit.limit : undefined;
    const arrayLimit = fieldLimit && fieldLimit.type === 'array' ? fieldLimit.limit : undefined;

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
          {icon}
          {label}
          {hasChanged && (
            <Badge className="ml-2 bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
              Modified
            </Badge>
          )}
          {type === 'array' && arrayLimit && (
            <span className="ml-auto text-xs text-gray-400">
              {Array.isArray(value) ? value.length : 0}/{arrayLimit} items
            </span>
          )}
        </Label>
        
        {type === 'array' ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {Array.isArray(value) ? value.map((item: string, index: number) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className={cn(
                    "bg-gray-800 text-gray-300 border-gray-700",
                    hasChanged && "border-yellow-500/50"
                  )}
                >
                  {item}
                  {isEditable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-1 p-0 h-auto"
                      onClick={() => handleArrayFieldRemove(field, index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </Badge>
              )) : (
                <span className="text-gray-500 text-sm italic">No items</span>
              )}
            </div>
            {isEditable && (
              <div className="flex gap-2">
                <Input
                  placeholder={placeholder || `Add ${label.toLowerCase()}`}
                  className="bg-gray-800 border-gray-700 text-white"
                  disabled={arrayLimit ? (Array.isArray(value) && value.length >= arrayLimit) : false}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleArrayFieldAdd(field, (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-gray-800 border-gray-700"
                  disabled={arrayLimit ? (Array.isArray(value) && value.length >= arrayLimit) : false}
                  onClick={() => {
                    const input = document.querySelector(`input[placeholder="${placeholder || `Add ${label.toLowerCase()}`}"]`) as HTMLInputElement;
                    if (input && input.value) {
                      handleArrayFieldAdd(field, input.value);
                      input.value = '';
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
            {isEditable && arrayLimit && Array.isArray(value) && value.length >= arrayLimit && (
              <p className="text-xs text-yellow-400">Maximum items reached</p>
            )}
          </div>
        ) : type === 'textarea' ? (
          <>
            {isEditable ? (
              <Textarea
                value={value}
                onChange={(e) => handleInputChange(field, e.target.value)}
                placeholder={placeholder}
                className={cn(
                  "bg-gray-800 border-gray-700 text-white min-h-[100px]",
                  hasChanged && "border-yellow-500/50"
                )}
                disabled={!isEditable}
                maxLength={charLimit}
              />
            ) : (
              <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
                <p className="text-gray-300 whitespace-pre-wrap">{value || 'Not specified'}</p>
              </div>
            )}
            {isEditable && charLimit && (
              <div className="flex justify-end">
                <span className={cn("text-xs", getCharCountColor(value.length, charLimit))}>
                  {value.length}/{charLimit} characters
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            {isEditable ? (
              <Input
                value={value}
                onChange={(e) => handleInputChange(field, e.target.value)}
                placeholder={placeholder}
                className={cn(
                  "bg-gray-800 border-gray-700 text-white",
                  hasChanged && "border-yellow-500/50"
                )}
                disabled={!isEditable}
                maxLength={charLimit}
              />
            ) : (
              <div className="p-3 bg-gray-800 border border-gray-700 rounded-md">
                <p className="text-gray-300">{value || 'Not specified'}</p>
              </div>
            )}
            {isEditable && charLimit && (
              <div className="flex justify-end">
                <span className={cn("text-xs", getCharCountColor(value.length, charLimit))}>
                  {value.length}/{charLimit} characters
                </span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="h-full">
      <TabsList className="grid grid-cols-7 gap-2 bg-gray-800 p-1 mx-6 mt-4">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={
              tab.id === 'insights' 
                ? "data-[state=active]:bg-purple-700 data-[state=active]:text-white bg-purple-900/30 border border-purple-500/50 text-purple-300 hover:text-purple-200" 
                : "data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            }
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
            {tab.id === 'insights' && (
              <span className="ml-2 text-xs bg-purple-500/20 px-1.5 py-0.5 rounded">
                Manual
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="px-6 py-4">
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderField('ICP Name', 'icp_name', 'text', 'Enter a descriptive name', <Target className="w-4 h-4" />)}
              {renderField('Description', 'description', 'textarea', 'Describe this ICP', <MessageSquare className="w-4 h-4" />)}
              {renderField('Geographic Focus', 'geographic_focus', 'text', 'e.g., North America, Europe', <Globe className="w-4 h-4" />)}
              {renderField('Sales Cycle Length', 'sales_cycle_length', 'text', 'e.g., 3-6 months', <ChartBar className="w-4 h-4" />)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Targeting Tab */}
        <TabsContent value="targeting" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Target Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderField('Job Titles', 'job_titles', 'array', 'Add job title', <Briefcase className="w-4 h-4" />)}
              {renderField('Industry Focus', 'industry_focus', 'array', 'Add industry', <Building className="w-4 h-4" />)}
              {renderField('Technology Stack', 'technology_stack', 'array', 'Add technology', <Settings className="w-4 h-4" />)}
              {renderField('Decision Making Process', 'decision_making_process', 'textarea', 'Describe the decision process', <Users className="w-4 h-4" />)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Company Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderField('Company Characteristics', 'company_characteristics', 'textarea', 'Describe ideal company traits', <Building className="w-4 h-4" />)}
              {renderField('Company Size Range', 'company_size_range', 'text', 'e.g., 50-500 employees', <Users className="w-4 h-4" />)}
              {renderField('Budget Range', 'budget_range', 'text', 'e.g., $10K-$100K', <DollarSign className="w-4 h-4" />)}
              {renderField('Competitive Alternatives', 'competitive_alternatives', 'array', 'Add competitor', <Target className="w-4 h-4" />)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Engagement Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderField('Pain Points', 'pain_points', 'array', 'Add pain point', <AlertCircle className="w-4 h-4" />)}
              {renderField('Value Drivers', 'value_drivers', 'array', 'Add value driver', <ChartBar className="w-4 h-4" />)}
              {renderField('Success Metrics', 'success_metrics', 'array', 'Add success metric', <ChartBar className="w-4 h-4" />)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messaging Tab */}
        <TabsContent value="messaging" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Messaging & Communication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderField('Preferred Communication Channels', 'preferred_communication_channels', 'array', 'Add channel', <MessageSquare className="w-4 h-4" />)}
              {renderField('Common Objections', 'objections_and_concerns', 'array', 'Add objection', <AlertCircle className="w-4 h-4" />)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab - Now with all manual entry fields */}
        <TabsContent value="insights" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-purple-400" />
                Strategic Insights
                <Badge className="ml-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Optional Manual Entry
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">
                Customise these fields with your specific market knowledge and strategic insights
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Market Analysis Fields */}
              <div className="space-y-4 p-4 rounded-lg bg-purple-900/20 border border-purple-500/30">
                <h3 className="text-sm font-medium text-purple-300 mb-3">Your Strategic Analysis</h3>
                {renderField('Market Trends', 'market_trends', 'textarea', 'Describe relevant market trends', <ChartBar className="w-4 h-4" />)}
                {renderField('Competitive Landscape', 'competitive_landscape', 'textarea', 'Describe the competitive landscape', <Target className="w-4 h-4" />)}
                {renderField('Growth Opportunities', 'growth_opportunities', 'array', 'Add growth opportunity', <Lightbulb className="w-4 h-4" />)}
                {renderField('Risk Factors', 'risk_factors', 'array', 'Add risk factor', <AlertCircle className="w-4 h-4" />)}
              </div>

              {/* Manual Entry Fields */}
              <div className="space-y-4 p-4 rounded-lg bg-purple-900/20 border border-purple-500/30">
                <h3 className="text-sm font-medium text-purple-300 mb-3 flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Your Strategic Input
                </h3>
                {renderField('Buying Signals', 'buying_signals', 'array', 'Add specific triggers that indicate purchase readiness', <Target className="w-4 h-4" />)}
                {renderField('Key Messaging Points', 'key_messaging_points', 'array', 'Add your unique value propositions', <MessageSquare className="w-4 h-4" />)}
                {renderField('Call to Action', 'call_to_action', 'textarea', 'Define your specific ask and next steps', <Target className="w-4 h-4" />)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Personas Tab (only in view mode with metadata) */}
        {mode === 'view' && metadata?.personas?.length > 0 && (
          <TabsContent value="personas" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metadata.personas.map((persona: any, index: number) => (
                <Card key={index} className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {persona.title}
                    </CardTitle>
                    <p className="text-sm text-gray-400">{persona.role}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Motivations</h4>
                      <ul className="space-y-1">
                        {persona.motivations?.map((motivation: string, i: number) => (
                          <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            {motivation}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Frustrations</h4>
                      <ul className="space-y-1">
                        {persona.frustrations?.map((frustration: string, i: number) => (
                          <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            {frustration}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
};
