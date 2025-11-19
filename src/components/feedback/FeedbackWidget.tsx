import { useState } from 'react'
import { X, MessageCircle, Send } from 'lucide-react'
import { useFeedbackContext } from '@/hooks/useFeedbackContext'
import { useActiveFeedbackItem } from '@/contexts/FeedbackContext'
import { useAuth } from '@/hooks/useAuth'
import { submitFeedback } from '@/services/feedbackService'
import { toast } from 'sonner'

interface FeedbackWidgetProps {
  className?: string
}

type FeedbackType = 'love_it' | 'issue' | 'suggestion' | 'question'
type FeedbackTarget = 'general' | 'product-general' | 'product-current' | 'icp-general' | 'icp-current' | 'message-general' | 'message-current' | 'research-general' | 'research-current'

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string; emoji: string }[] = [
  { value: 'love_it', label: 'Love it', emoji: '💚' },
  { value: 'issue', label: 'Issue', emoji: '🐛' },
  { value: 'suggestion', label: 'Suggestion', emoji: '💡' },
  { value: 'question', label: 'Question', emoji: '❓' },
]

export function FeedbackWidget({ className = '' }: FeedbackWidgetProps) {
  const { user } = useAuth()
  const context = useFeedbackContext()
  const { activeItems } = useActiveFeedbackItem()
  const [isExpanded, setIsExpanded] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion')
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget>('general')
  const [subject, setSubject] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.email) {
      toast.error('You must be logged in to submit feedback')
      return
    }

    if (!subject.trim() || !feedback.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)

    try {
      // Build enhanced context based on feedback target and active items
      const enhancedContext = {
        ...context,
        feedbackTarget,
        // Set IDs based on target and active items
        productId: feedbackTarget === 'product-current' ? activeItems.productId : undefined,
        icpId: feedbackTarget === 'icp-current' ? activeItems.icpId : undefined,
        messageId: feedbackTarget === 'message-current' ? activeItems.messageId : undefined,
        researchId: feedbackTarget === 'research-current' ? activeItems.researchId : undefined,
      }

      await submitFeedback({
        userId: user.id,
        email: user.email,
        subject,
        feedback,
        feedbackType,
        context: enhancedContext,
      })

      toast.success('Feedback submitted! Thank you for helping us improve.')

      // Reset form
      setSubject('')
      setFeedback('')
      setFeedbackTarget('general')
      setIsExpanded(false)
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTargetLabel = (target: FeedbackTarget): string => {
    const labels: Record<FeedbackTarget, string> = {
      'general': 'General App Feedback',
      'product-general': 'Products (General)',
      'product-current': activeItems.productId ? `Product: ${activeItems.productId}` : 'Products (General)',
      'icp-general': 'ICPs (General)',
      'icp-current': activeItems.icpId ? `ICP: ${activeItems.icpId}` : 'ICPs (General)',
      'message-general': 'Messages (General)',
      'message-current': activeItems.messageId ? `Message: ${activeItems.messageId.toString().slice(0, 8)}...` : 'Messages (General)',
      'research-general': 'Prospect Research (General)',
      'research-current': activeItems.researchId ? `Research: ${activeItems.researchId.toString().slice(0, 8)}...` : 'Prospect Research (General)',
    }
    return labels[target]
  }

  const getAvailableTargets = (): { value: FeedbackTarget; label: string; group?: string }[] => {
    const targets: { value: FeedbackTarget; label: string; group?: string }[] = [
      { value: 'general', label: 'General App Feedback' },
    ]

    // Add Product options
    targets.push({ value: 'product-general', label: 'General', group: 'Products' })
    if (activeItems.productId) {
      targets.push({ value: 'product-current', label: 'Current Product', group: 'Products' })
    }

    // Add ICP options
    targets.push({ value: 'icp-general', label: 'General', group: 'ICPs' })
    if (activeItems.icpId) {
      targets.push({ value: 'icp-current', label: 'Current ICP', group: 'ICPs' })
    }

    // Add Message options
    targets.push({ value: 'message-general', label: 'General', group: 'Messages' })
    if (activeItems.messageId) {
      targets.push({ value: 'message-current', label: 'Current Message', group: 'Messages' })
    }

    // Add Prospect Research options
    targets.push({ value: 'research-general', label: 'General', group: 'Prospect Research' })
    if (activeItems.researchId) {
      targets.push({ value: 'research-current', label: 'Current Research', group: 'Prospect Research' })
    }

    return targets
  }

  const getContextDisplay = () => {
    return getTargetLabel(feedbackTarget)
  }

  return (
    <div className={`fixed bottom-6 right-6 z-[60] ${className}`}>
      {/* Collapsed Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white shadow-lg hover:shadow-xl hover:shadow-[#FBAE1C]/30 transition-all duration-300 flex items-center justify-center group"
          aria-label="Open feedback form"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Expanded Form */}
      {isExpanded && (
        <div
          className="w-[380px] max-h-[90vh] bg-[#0a0e1b]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        >
          {/* Header */}
          <div className="relative px-6 py-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Send Feedback</h3>
                <p className="text-xs text-gray-400 mt-1">{getContextDisplay()}</p>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                aria-label="Close feedback form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Feedback About Selector */}
            <div>
              <label htmlFor="feedback-about" className="block text-sm font-medium text-gray-300 mb-2">
                Feedback About
              </label>
              <select
                id="feedback-about"
                value={feedbackTarget}
                onChange={(e) => setFeedbackTarget(e.target.value as FeedbackTarget)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-transparent transition-all"
              >
                {getAvailableTargets().map((target, index) => {
                  // Check if this is the start of a new group
                  const prevTarget = getAvailableTargets()[index - 1]
                  const isNewGroup = target.group && target.group !== prevTarget?.group

                  return (
                    <option key={target.value} value={target.value}>
                      {target.group ? `${target.group} - ${target.label}` : target.label}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Feedback Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FEEDBACK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFeedbackType(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      feedbackType === option.value
                        ? 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white shadow-md'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                    }`}
                  >
                    <span className="mr-1.5">{option.emoji}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="feedback-subject" className="block text-sm font-medium text-gray-300 mb-2">
                Subject
              </label>
              <input
                id="feedback-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your feedback"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-transparent transition-all"
                maxLength={100}
                required
              />
            </div>

            {/* Feedback Text */}
            <div>
              <label htmlFor="feedback-text" className="block text-sm font-medium text-gray-300 mb-2">
                Details
              </label>
              <textarea
                id="feedback-text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us more about your feedback..."
                rows={6}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FBAE1C] focus:border-transparent transition-all resize-none"
                maxLength={1000}
                required
              />
              <div className="mt-1 text-xs text-gray-500 text-right">
                {feedback.length}/1000
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !subject.trim() || !feedback.trim()}
              className="w-full px-4 py-3 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#FBAE1C]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Feedback
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
