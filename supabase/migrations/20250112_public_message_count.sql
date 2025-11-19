-- Create a public function to get the total message count
-- This allows unauthenticated users on the login page to see the counter
-- Security: This only exposes a single aggregate count, no sensitive data

CREATE OR REPLACE FUNCTION public.get_public_message_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::bigint
  FROM public.message_generation_logs;
$$;

-- Grant execute permission to anon (unauthenticated) and authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_message_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_message_count() TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION public.get_public_message_count() IS
'Returns the total count of messages generated across all users. Used for public statistics display on the login page.';
