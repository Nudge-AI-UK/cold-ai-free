import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Target,
  Zap,
  Brain,
  Loader2
} from 'lucide-react';

interface AIFeedbackPanelProps {
  metadata: any;
  mode: 'edit' | 'review' | 'view';
  formData?: any;
  onSuggestionApply?: (updatedData: any) => void;
}

export const AIFeedbackPanel: React.FC<AIFeedbackPanelProps> = ({
  metadata,
  mode,
  formData,
  onSuggestionApply
}) => {
  // Extract AI feedback from metadata
  const aiFeedback = metadata?.ai_feedback || {};
  const qualityScores = aiFeedback?.quality_assessment?.scores || {};
  const suggestions = aiFeedback?.suggestions || {};
  const messagingGuidelines = metadata?.messaging_guidelines || {};
  const qualificationCriteria = metadata?.qualification_criteria || {};

  // Calculate overall score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Score badge component
  const ScoreBadge = ({ label, score }: { label: string; score: number }) => (
    <div className="flex flex-col items-center p-2 bg-gray-800 rounded-lg">
      <span className="text-xs text-gray-400 mb-1">{label}</span>
      <span className={`text-lg font-bold ${getScoreColor(score)}`}>
        {score}%
      </span>
      <Progress 
        value={score} 
        className="w-full h-1 mt-1" 
      />
    </div>
  );

  // If in review mode, show processing state
  if (mode === 'review') {
    return (
      <div className="w-96 border-l border-gray-700 bg-gray-900/50 p-6 overflow-y-auto">
        <div className="flex flex-col items-center justify-center h-full">
          <Brain className="w-16 h-16 text-blue-500 mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold text-white mb-2">AI Processing</h3>
          <p className="text-sm text-gray-400 text-center">
            Generating personalised insights and recommendations for your ICP...
          </p>
          <Loader2 className="w-8 h-8 text-blue-500 mt-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 border-l border-gray-700 bg-gray-900/50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            AI Insights
          </h3>
          {mode === 'edit' && (
            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              Helping Mode
            </Badge>
          )}
        </div>

        {/* Quality Scores */}
        {qualityScores.overall !== undefined && (
          <div className="grid grid-cols-2 gap-2">
            <ScoreBadge label="Overall" score={qualityScores.overall || 0} />
            <ScoreBadge label="Completeness" score={qualityScores.completeness || 0} />
            <ScoreBadge label="Specificity" score={qualityScores.specificity || 0} />
            <ScoreBadge label="Actionability" score={qualityScores.actionability || 0} />
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4 space-y-6">
          {/* AI Summary */}
          {aiFeedback.summary && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-300">
                  AI Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">{aiFeedback.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Critical Suggestions */}
          {suggestions.critical?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-semibold text-white">Critical Improvements</h4>
              </div>
              <div className="space-y-2">
                {suggestions.critical.map((suggestion: string, index: number) => (
                  <Alert key={index} className="bg-red-500/10 border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <AlertDescription className="text-sm text-gray-300">
                      {suggestion}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Important Suggestions */}
          {suggestions.important?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <h4 className="text-sm font-semibold text-white">Recommended Enhancements</h4>
              </div>
              <div className="space-y-2">
                {suggestions.important.map((suggestion: string, index: number) => (
                  <Alert key={index} className="bg-yellow-500/10 border-yellow-500/20">
                    <TrendingUp className="w-4 h-4 text-yellow-500" />
                    <AlertDescription className="text-sm text-gray-300">
                      {suggestion}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Top Gaps */}
          {suggestions.top_gaps?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-white">Key Gaps to Address</h4>
              </div>
              <div className="space-y-2">
                {suggestions.top_gaps.map((gap: string, index: number) => (
                  <div
                    key={index}
                    className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                  >
                    <p className="text-sm text-gray-300">{gap}</p>
                    {mode === 'edit' && onSuggestionApply && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 text-blue-400 hover:text-blue-300"
                        onClick={() => {
                          // Here we'd implement the logic to apply the suggestion
                          toast.info('Feature coming soon: Auto-apply suggestion');
                        }}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        Quick Fix
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messaging Guidelines */}
          {(messagingGuidelines.words_to_use?.length > 0 || 
            messagingGuidelines.words_to_avoid?.length > 0) && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-300">
                  Messaging Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {messagingGuidelines.words_to_use?.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 mb-2">Words to Use:</p>
                    <div className="flex flex-wrap gap-1">
                      {messagingGuidelines.words_to_use.map((word: string, i: number) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs bg-green-500/10 text-green-400 border-green-500/20"
                        >
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {messagingGuidelines.words_to_avoid?.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 mb-2">Words to Avoid:</p>
                    <div className="flex flex-wrap gap-1">
                      {messagingGuidelines.words_to_avoid.map((word: string, i: number) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs bg-red-500/10 text-red-400 border-red-500/20"
                        >
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Qualification Criteria */}
          {(qualificationCriteria.must_haves?.length > 0 || 
            qualificationCriteria.red_flags?.length > 0) && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-300">
                  Qualification Criteria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {qualificationCriteria.must_haves?.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 mb-2">Must-Haves:</p>
                    <ul className="space-y-1">
                      {qualificationCriteria.must_haves.map((item: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {qualificationCriteria.red_flags?.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 mb-2">Red Flags:</p>
                    <ul className="space-y-1">
                      {qualificationCriteria.red_flags.map((item: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-300">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No feedback message */}
          {!metadata && mode === 'edit' && (
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <AlertDescription className="text-sm text-gray-300">
                AI suggestions will appear here as you fill in the ICP details. 
                The more complete your ICP, the better the recommendations!
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// Add missing import
import { toast } from 'sonner';
