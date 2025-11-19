import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

export interface FeedbackContext {
  page: string;
  feature?: string;
  productId?: string;
  icpId?: string;
  messageId?: string;
  feedbackTarget?: string;
}

/**
 * Hook to capture current page and item context for feedback submissions
 * Automatically detects the current page and any product/ICP/message being viewed
 */
export function useFeedbackContext(): FeedbackContext {
  const location = useLocation();

  return useMemo(() => {
    const context: FeedbackContext = {
      page: location.pathname,
    };

    // Extract context from URL pathname
    if (location.pathname === '/') {
      context.feature = 'dashboard';
    } else if (location.pathname.startsWith('/prospects')) {
      context.feature = 'prospects';
    } else if (location.pathname.startsWith('/outreach')) {
      context.feature = 'outreach';
    }

    // Extract context from URL search params
    const searchParams = new URLSearchParams(location.search);

    // Check for product ID in query params
    const productId = searchParams.get('productId') || searchParams.get('product_id');
    if (productId) {
      context.productId = productId;
    }

    // Check for ICP ID in query params
    const icpId = searchParams.get('icpId') || searchParams.get('icp_id');
    if (icpId) {
      context.icpId = icpId;
    }

    // Check for message ID in query params
    const messageId = searchParams.get('messageId') || searchParams.get('message_id');
    if (messageId) {
      context.messageId = messageId;
    }

    // Try to extract IDs from pathname (e.g., /prospects/123 or /outreach/message-uuid)
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 1) {
      const lastPart = pathParts[pathParts.length - 1];

      // If it looks like a number, it might be a product or ICP ID
      if (/^\d+$/.test(lastPart)) {
        if (pathParts[0] === 'products') {
          context.productId = lastPart;
        } else if (pathParts[0] === 'icps') {
          context.icpId = lastPart;
        }
      }
      // If it looks like a UUID, it might be a message ID
      else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastPart)) {
        context.messageId = lastPart;
      }
    }

    return context;
  }, [location.pathname, location.search]);
}
