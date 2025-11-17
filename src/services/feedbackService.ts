import { supabase } from '@/integrations/supabase/client'
import { FeedbackContext } from '@/hooks/useFeedbackContext'

export interface SubmitFeedbackParams {
  userId?: string
  email: string
  subject: string
  feedback: string
  feedbackType: 'love_it' | 'issue' | 'suggestion' | 'question'
  context: FeedbackContext
}

/**
 * Submit feedback to the database
 */
export async function submitFeedback(params: SubmitFeedbackParams) {
  const { userId, email, subject, feedback, feedbackType, context } = params

  // Build context_data JSONB object
  const contextData = {
    page: context.page,
    ...(context.feature && { feature: context.feature }),
    ...(context.productId && { productId: context.productId }),
    ...(context.icpId && { icpId: context.icpId }),
    ...(context.messageId && { messageId: context.messageId }),
  }

  const { data, error } = await supabase
    .from('user_feedback')
    .insert({
      user_id: userId || null,
      email,
      subject,
      feedback,
      feedback_type: feedbackType,
      context_data: contextData,
      status: 'new',
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting feedback:', error)
    throw new Error(`Failed to submit feedback: ${error.message}`)
  }

  return data
}

/**
 * Get user's own feedback submissions
 */
export async function getUserFeedback(email: string) {
  const { data, error } = await supabase
    .from('user_feedback')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user feedback:', error)
    throw new Error(`Failed to fetch feedback: ${error.message}`)
  }

  return data
}
