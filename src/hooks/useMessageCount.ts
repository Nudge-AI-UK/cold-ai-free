import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMessageCount = () => {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchMessageCount = async () => {
      try {
        setIsLoading(true);

        // Use the public function that bypasses RLS
        const { data, error } = await supabase.rpc('get_public_message_count');

        if (error) {
          console.error('❌ Error fetching message count:', error);
          throw error;
        }

        console.log('✅ Message count fetched:', data);
        setCount(data || 0);
        setError(null);
      } catch (err) {
        console.error('💥 Failed to fetch message count:', err);
        setError(err as Error);
        // Set a fallback count on error
        setCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchMessageCount();

    // Set up real-time subscription to message_generation_logs
    // Note: This may not work for unauthenticated users, but the periodic refresh will
    const channel = supabase
      .channel('message_count_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_generation_logs',
        },
        () => {
          console.log('📨 New message detected, refreshing count...');
          // Refetch count when new message is generated
          fetchMessageCount();
        }
      )
      .subscribe((status) => {
        console.log('🔌 Realtime subscription status:', status);
      });

    // Also refresh count every 30 seconds as a fallback
    const intervalId = setInterval(() => {
      console.log('🔄 Periodic refresh of message count...');
      fetchMessageCount();
    }, 30000);

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, []);

  return { count, isLoading, error };
};
