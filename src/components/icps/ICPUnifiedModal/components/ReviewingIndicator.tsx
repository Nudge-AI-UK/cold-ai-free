import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ReviewingIndicatorProps {
  icpName: string;
  description?: string;
}

export const ReviewingIndicator: React.FC<ReviewingIndicatorProps> = ({
  icpName,
  description
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl space-y-6"
      >
        {/* Main reviewing card */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-8 text-center space-y-6">
            {/* Animated brain icon */}
            <div className="flex justify-center">
              <div className="relative">
                <Brain className="w-20 h-20 text-blue-500" />
              </div>
            </div>

            {/* Title and description */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                ICP Under Review
              </h2>
              <p className="text-gray-400">
                {description || `AI is reviewing and enriching "${icpName}" based on your approved changes`}
              </p>
            </div>

            {/* Status indicator */}
            <div className="flex justify-center">
              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-4 py-2">
                <Clock className="w-4 h-4 mr-2" />
                Review in Progress
              </Badge>
            </div>

            {/* Info message */}
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <Info className="w-4 h-4 text-blue-500" />
              <AlertDescription className="text-gray-300">
                The AI is analysing your approved changes and generating enriched insights, 
                buyer personas, and messaging guidelines. This typically takes 1-2 minutes.
              </AlertDescription>
            </Alert>

            {/* Additional context */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                What's happening now?
              </h3>
              <div className="space-y-2 text-left">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-400">
                    Analysing your changes against market data
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-400">
                    Generating personalised buyer personas
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-400">
                    Creating tailored messaging strategies
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-400">
                    Building qualification criteria
                  </p>
                </div>
              </div>
            </div>

            {/* Note about viewing */}
            <p className="text-sm text-gray-500">
              You can close this window and return later. The ICP will automatically 
              update to "Active" status once the review is complete.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
