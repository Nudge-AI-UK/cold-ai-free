import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, ArrowRight, Zap, Brain, Target, MessageSquare } from "lucide-react";
import { useMessageCount } from "@/hooks/useMessageCount";
import { TickerCounter } from "@/components/ui/animated-counter";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [lockoutInfo, setLockoutInfo] = useState<{
    locked: boolean;
    minutes_remaining?: number;
    attempts_remaining?: number;
  } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  // Password reset Turnstile state
  const [resetCaptchaToken, setResetCaptchaToken] = useState<string | null>(null);
  const resetTurnstileRef = useRef<HTMLDivElement>(null);
  const resetTurnstileWidgetId = useRef<string | null>(null);

  // Fetch real-time message count
  const { count: messageCount, isLoading: isLoadingCount } = useMessageCount();

  // Reset terms acceptance when switching between sign-up and login
  useEffect(() => {
    setTermsAccepted(false);
  }, [isSignUp]);

  // Check for OAuth callback and skip OTP verification for OAuth users
  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Check if user signed in via OAuth (Google, etc.)
        const isOAuthUser = session.user.app_metadata?.provider === 'google' ||
                           session.user.app_metadata?.providers?.includes('google');

        if (isOAuthUser) {
          // OAuth users don't need OTP verification - they're already verified by Google
          console.log('✅ OAuth user detected, skipping OTP verification');
          setShowOtpVerification(false);
        }
      }
    };

    handleAuthCallback();

    // Listen for auth state changes (e.g., OAuth redirect callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        const isOAuthUser = session.user.app_metadata?.provider === 'google' ||
                           session.user.app_metadata?.providers?.includes('google');

        if (isOAuthUser) {
          // Hide OTP modal for OAuth users
          console.log('✅ OAuth sign-in detected, user is verified');
          setShowOtpVerification(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load Turnstile script only once
  useEffect(() => {
    // Check if already loaded
    if (scriptLoadedRef.current || window.turnstile) {
      setTurnstileReady(true);
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript) {
      // Script exists, wait for it to load
      const checkTurnstile = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkTurnstile);
          scriptLoadedRef.current = true;
          setTurnstileReady(true);
        }
      }, 100);

      // Add timeout after 10 seconds
      const timeout = setTimeout(() => {
        clearInterval(checkTurnstile);
        console.error('Turnstile script failed to load within 10 seconds');
        toast.error('Security verification failed to load. Please refresh the page or disable ad blockers.');
      }, 10000);

      return () => {
        clearInterval(checkTurnstile);
        clearTimeout(timeout);
      };
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      setTurnstileReady(true);
    };
    document.body.appendChild(script);
  }, []);

  // Render Turnstile widget for both sign-up and login
  useEffect(() => {
    if (!turnstileReady || !showEmailForm || !turnstileRef.current) {
      return;
    }

    // Small delay to ensure DOM is ready
    const renderTimeout = setTimeout(() => {
      if (turnstileRef.current && window.turnstile) {
        // Clear previous widget if it exists
        if (turnstileWidgetId.current) {
          try {
            window.turnstile.remove(turnstileWidgetId.current);
          } catch (e) {
            console.warn('Failed to remove previous turnstile widget:', e);
          }
          turnstileWidgetId.current = null;
        }

        // Reset captcha token when switching modes
        setCaptchaToken(null);

        // Render new widget
        try {
          turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
            sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
            callback: (token: string) => {
              setCaptchaToken(token);
            },
            'error-callback': () => {
              toast.error('CAPTCHA verification failed. Please try again.');
              setCaptchaToken(null);
            },
            'timeout-callback': () => {
              toast.error('CAPTCHA verification timed out. Please try again.');
              setCaptchaToken(null);
            },
            'expired-callback': () => {
              console.log('CAPTCHA token expired, resetting...');
              setCaptchaToken(null);
            },
          });
        } catch (e) {
          console.error('Failed to render Turnstile widget:', e);
          toast.error('Failed to load security verification. Please refresh the page.');
        }
      }
    }, 100);

    return () => {
      clearTimeout(renderTimeout);
      if (turnstileWidgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetId.current);
        } catch (e) {
          console.warn('Failed to remove turnstile widget on cleanup:', e);
        }
        turnstileWidgetId.current = null;
      }
    };
  }, [isSignUp, showEmailForm, turnstileReady]);

  // Render Turnstile widget for password reset modal
  useEffect(() => {
    if (!turnstileReady || !showPasswordReset || !resetTurnstileRef.current) {
      return;
    }

    // Small delay to ensure DOM is ready
    const renderTimeout = setTimeout(() => {
      if (resetTurnstileRef.current && window.turnstile) {
        // Clear previous widget if it exists
        if (resetTurnstileWidgetId.current) {
          try {
            window.turnstile.remove(resetTurnstileWidgetId.current);
          } catch (e) {
            console.warn('Failed to remove previous reset turnstile widget:', e);
          }
          resetTurnstileWidgetId.current = null;
        }

        // Reset captcha token
        setResetCaptchaToken(null);

        // Render new widget
        try {
          resetTurnstileWidgetId.current = window.turnstile.render(resetTurnstileRef.current, {
            sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
            callback: (token: string) => {
              setResetCaptchaToken(token);
            },
            'error-callback': () => {
              toast.error('CAPTCHA verification failed. Please try again.');
              setResetCaptchaToken(null);
            },
            'timeout-callback': () => {
              toast.error('CAPTCHA verification timed out. Please try again.');
              setResetCaptchaToken(null);
            },
            'expired-callback': () => {
              console.log('Password reset CAPTCHA token expired, resetting...');
              setResetCaptchaToken(null);
            },
          });
        } catch (e) {
          console.error('Failed to render reset Turnstile widget:', e);
          toast.error('Failed to load security verification. Please refresh the page.');
        }
      }
    }, 100);

    return () => {
      clearTimeout(renderTimeout);
      if (resetTurnstileWidgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(resetTurnstileWidgetId.current);
        } catch (e) {
          console.warn('Failed to remove reset turnstile widget on cleanup:', e);
        }
        resetTurnstileWidgetId.current = null;
      }
    };
  }, [showPasswordReset, turnstileReady]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check captcha for both sign up and login
      if (!captchaToken) {
        toast.error("Please complete the CAPTCHA verification");
        setIsLoading(false);
        return;
      }

      // Check terms acceptance for sign up
      if (isSignUp && !termsAccepted) {
        toast.error("Please accept the Terms & Conditions to continue");
        setIsLoading(false);
        return;
      }

      if (isSignUp) {
        // Check if this email was previously deleted
        let history = null
        try {
          const { data: deletionHistory, error: historyError } = await supabase.rpc('check_email_deletion_history', {
            p_email: email
          })

          if (historyError) {
            console.warn('⚠️ Failed to check deletion history:', historyError)
            // Continue with signup even if check fails
          } else {
            history = deletionHistory?.[0]
          }

          if (history?.previously_deleted && history?.within_limit_period) {
            // Account was deleted within 30 days - allow recovery
            toast.info(
              `Welcome back! Your account has been recovered. Your previous usage limits have been restored.`,
              { duration: 6000 }
            )
            // Continue with signup - they're recovering their account
          }
        } catch (e) {
          console.warn('⚠️ Deletion history check failed, continuing with signup:', e)
          // Continue with signup even if check fails
        }

        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`,
            data: {
              full_name: email.split('@')[0], // Default name from email
              terms_accepted: termsAccepted,
              terms_version: '2024-10-16',
              privacy_version: '2024-10-16',
              // Store previous usage if account was deleted before
              previous_usage: history?.previously_deleted ? {
                messages_sent: history.messages_used || 0,
                deleted_at: history.deleted_at
              } : null
            },
            captchaToken, // Include captcha token
          },
        });

        if (error) throw error;

        console.log('✅ Signup successful, data:', data)

        // Show warning if re-signing up after deletion (outside 30-day period)
        if (history?.previously_deleted && !history?.within_limit_period) {
          toast.info(
            'Welcome back! Your usage limits have been restored from your previous account.',
            { duration: 6000 }
          )
        }

        // Only show OTP verification for email/password signups (not OAuth)
        // Provider will be 'email' for email/password, or 'google'/'github' etc for OAuth
        const isEmailPasswordSignup = data?.user && data.user.app_metadata?.provider === 'email';

        console.log('🔍 Checking if should show OTP:', {
          isEmailPasswordSignup,
          hasUser: !!data?.user,
          provider: data?.user?.app_metadata?.provider
        })

        if (isEmailPasswordSignup) {
          console.log('📧 Setting OTP verification with email:', email)
          setVerificationEmail(email);
          setShowOtpVerification(true);
          toast.success("Verification code sent! Check your email.");
        } else {
          console.log('⚠️ Not showing OTP - OAuth signup or no user')
          toast.success("Account created successfully!");
        }

        setIsLoading(false);
      } else {
        console.log('🔐 Attempting login for:', email);

        // Check rate limit before attempting login
        const { data: rateLimitCheck, error: rateLimitError } = await supabase.functions.invoke(
          'check-login-rate-limit',
          {
            body: { email, action: 'check' }
          }
        );

        if (rateLimitError) {
          console.warn('⚠️ Rate limit check failed, proceeding with login:', rateLimitError);
        }

        if (rateLimitCheck?.locked) {
          setLockoutInfo({
            locked: true,
            minutes_remaining: rateLimitCheck.minutes_remaining
          });
          toast.error(rateLimitCheck.message);
          setIsLoading(false);
          return;
        }

        // Show warning if approaching lockout
        if (rateLimitCheck?.attempts_remaining <= 2 && rateLimitCheck?.attempts_remaining > 0) {
          toast.warning(`Warning: ${rateLimitCheck.attempts_remaining} attempt(s) remaining before lockout`);
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            captchaToken, // Include captcha token for login
          },
        });

        // Record the login attempt
        await supabase.functions.invoke('check-login-rate-limit', {
          body: {
            email,
            action: 'record_attempt',
            success: !error,
            user_agent: navigator.userAgent
          }
        });

        if (error) {
          console.error('❌ Login error:', error);

          // Check if this caused a lockout
          const { data: postAttemptCheck } = await supabase.functions.invoke(
            'check-login-rate-limit',
            {
              body: { email, action: 'check' }
            }
          );

          if (postAttemptCheck?.locked) {
            setLockoutInfo({
              locked: true,
              minutes_remaining: postAttemptCheck.minutes_remaining
            });
          } else if (postAttemptCheck?.attempts_remaining !== undefined) {
            setLockoutInfo({
              locked: false,
              attempts_remaining: postAttemptCheck.attempts_remaining
            });
          }

          throw error;
        }

        // Success - check if account was pending deletion and recover it
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('account_status, deletion_requested_at')
            .eq('user_id', user.id)
            .single()

          // If account was pending deletion, recover it
          if (userProfile?.account_status === 'pending_deletion') {
            await supabase
              .from('user_profiles')
              .update({
                account_status: 'active',
                deletion_requested_at: null,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)

            // Remove from deleted_accounts tracking
            const emailHash = await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(email.toLowerCase())
            )
            const emailHashHex = Array.from(new Uint8Array(emailHash))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('')

            await supabase
              .from('deleted_accounts')
              .delete()
              .eq('email_hash', emailHashHex)

            toast.success("Welcome back! Your account has been recovered.", { duration: 5000 })
            console.log('✅ Account recovered from pending deletion')
          } else {
            toast.success("Welcome back!")
          }
        }

        console.log('✅ Login successful');
        setLockoutInfo(null); // Clear any lockout info
      }
    } catch (error: any) {
      console.error('💥 Auth error:', error);
      toast.error(error.message || "An error occurred during authentication.");
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // Use localhost for development, production URL otherwise
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isDevelopment
        ? `http://localhost:${window.location.port}`
        : import.meta.env.VITE_APP_URL || window.location.origin;

      console.log('🔐 OAuth redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      // OAuth will redirect, so no need to handle success here
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google.");
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: verificationEmail,
        token: otpCode,
        type: 'email',
      });

      if (error) throw error;

      toast.success("Email verified! Welcome to Cold AI!");
      setShowOtpVerification(false);
      // AuthContext will handle the session and redirect
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code. Please try again.");
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: verificationEmail,
      });

      if (error) throw error;

      toast.success("New verification code sent! Check your email.");
      setOtpCode(""); // Clear the input
      setIsLoading(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code. Please try again.");
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (resetEmail: string) => {
    try {
      // Check captcha token
      if (!resetCaptchaToken) {
        toast.error("Please complete the CAPTCHA verification.");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      // Unlock account when password reset is requested
      await supabase.functions.invoke('check-login-rate-limit', {
        body: { email: resetEmail, action: 'unlock' }
      });

      toast.success("Password reset link sent! Check your email.");
      setShowPasswordReset(false);
      setResetCaptchaToken(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email.");
    }
  };

  const features = [
    { icon: Brain, text: "AI-Powered Messages", color: "from-purple-500 to-pink-500" },
    { icon: Target, text: "Smart ICP Targeting", color: "from-blue-500 to-cyan-500" },
    { icon: MessageSquare, text: "Personalised Outreach", color: "from-green-500 to-emerald-500" },
    { icon: Zap, text: "Super-Fast Research", color: "from-orange-500 to-amber-500" }
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center" style={{
      background: 'linear-gradient(135deg, #0a0f1b 0%, #1a1f2e 100%)',
      backgroundColor: '#0a0f1b'
    }}>
      {/* Animated Background - Properly Contained */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 -left-1/4 w-1/2 h-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(251, 146, 60, 0.08) 0%, transparent 70%)',
            filter: 'blur(80px)',
            willChange: 'transform'
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
            filter: 'blur(80px)',
            willChange: 'transform'
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [-50, 50, -50],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
            filter: 'blur(80px)',
            willChange: 'transform'
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="hidden md:block"
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl border border-orange-500/20" style={{
                  background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(245, 158, 11, 0.15))',
                  backgroundColor: 'rgba(251, 146, 60, 0.1)'
                }}>
                  <img src="/Square_bishop.svg" alt="Cold AI" className="w-10 h-10" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                  Cold AI
                </h1>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white">
                  Transform Your
                  <span className="block bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                    Sales Outreach
                  </span>
                </h2>
                <p className="text-gray-400 text-lg">
                  Generate personalised messages that convert prospects into conversations.
                </p>
              </div>

              {/* Feature Pills */}
              <div className="grid grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="group relative"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} rounded-lg opacity-0 group-hover:opacity-30 transition-opacity`} style={{ filter: 'blur(12px)' }}></div>
                    <div className="relative flex items-center gap-2 p-3 rounded-lg border border-gray-700 group-hover:border-gray-600 transition-colors" style={{
                      backgroundColor: 'rgba(31, 41, 55, 0.7)'
                    }}>
                      <feature.icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">{feature.text}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex justify-center pt-4">
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    {isLoadingCount ? (
                      <div className="h-8 w-24 bg-gray-700/30 animate-pulse rounded"></div>
                    ) : (
                      <TickerCounter
                        value={messageCount}
                        className="text-2xl font-bold text-white"
                        digitClassName="text-2xl font-bold text-white"
                      />
                    )}
                  </div>
                  <p className="text-sm text-gray-400">Messages Generated</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Side - Auth Form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="border-gray-700 shadow-2xl" style={{
              backgroundColor: 'rgba(31, 41, 55, 0.85)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)'
            }}>
              <CardHeader className="space-y-1 pb-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-white">
                    {isSignUp ? "Create Account" : "Welcome Back"}
                  </CardTitle>
                  <div className="md:hidden p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                    <img src="/Square_bishop.svg" alt="Cold AI" className="w-6 h-6" />
                  </div>
                </div>
                <CardDescription className="text-gray-400">
                  {isSignUp
                    ? "Start your journey to smarter outreach"
                    : "Enter your credentials to continue"}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {/* Google Login - Native Style */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg border border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* Google Logo SVG */}
                    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="text-[15px]">Continue with Google</span>
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    Quick setup, no password needed
                  </p>

                </div>

                {/* Divider / Email Toggle */}
                {!showEmailForm ? (
                  <div className="my-6">
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(true)}
                      className="w-full text-sm text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Use email instead</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Divider */}
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-gray-800 px-2 text-gray-500">Or use email</span>
                      </div>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
                        placeholder="you@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-300">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                    {isSignUp && (
                      <p className="text-xs text-gray-500">Password must be at least 6 characters</p>
                    )}
                  </div>

                  {/* Terms & Conditions Checkbox - Only for Sign Up */}
                  {isSignUp && (
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-900/50 text-orange-500 focus:ring-orange-500/20 focus:ring-offset-0"
                      />
                      <label htmlFor="terms" className="text-sm text-gray-300">
                        I agree to the{' '}
                        <a
                          href="https://coldai.uk/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 transition-colors underline"
                        >
                          Terms & Conditions
                        </a>
                        {' '}and{' '}
                        <a
                          href="https://coldai.uk/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 transition-colors underline"
                        >
                          Privacy Policy
                        </a>
                      </label>
                    </div>
                  )}

                  {/* Turnstile CAPTCHA Widget - Show for both sign up and login */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Verify you're human</Label>
                    <div className="relative min-h-[65px] flex justify-center items-center">
                      {/* Loading spinner - shows while CAPTCHA loads */}
                      {!captchaToken && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                            <p className="text-xs text-gray-500">Loading verification...</p>
                          </div>
                        </div>
                      )}
                      {/* Turnstile widget container */}
                      <div
                        ref={turnstileRef}
                        className="flex justify-center"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !captchaToken}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-2 transition-all duration-300 group"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span>{isSignUp ? "Create Account" : "Sign In"}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </Button>
                </form>

                {/* Lockout Warning */}
                {lockoutInfo?.locked && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400 text-center">
                      🔒 Account locked for {lockoutInfo.minutes_remaining} minutes due to too many failed attempts
                    </p>
                  </div>
                )}

                {/* Attempts Remaining Warning */}
                {lockoutInfo?.attempts_remaining !== undefined && lockoutInfo.attempts_remaining <= 2 && !lockoutInfo.locked && (
                  <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-sm text-yellow-400 text-center">
                      ⚠️ {lockoutInfo.attempts_remaining} attempt(s) remaining before lockout
                    </p>
                  </div>
                )}

                <div className="mt-6 text-center space-y-2">
                  <p className="text-sm text-gray-400">
                    {isSignUp ? "Already have an account?" : "Don't have an account?"}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="ml-1 text-orange-400 hover:text-orange-300 transition-colors font-medium"
                    >
                      {isSignUp ? "Sign in" : "Sign up"}
                    </button>
                  </p>

                  {/* Forgot Password Link */}
                  {!isSignUp && (
                    <p className="text-sm">
                      <button
                        type="button"
                        onClick={() => setShowPasswordReset(true)}
                        className="text-gray-400 hover:text-orange-400 transition-colors"
                      >
                        Forgot your password?
                      </button>
                    </p>
                  )}
                </div>
                  </>
                )}

                {/* Security Note */}
                <div className="mt-6 p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                  <p className="text-xs text-gray-400 text-center">
                    🔒 Your session stays active for 7 days. We use secure, encrypted connections.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Footer Links */}
            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <a href="https://coldai.uk" className="text-gray-400 hover:text-orange-400 transition-colors">
                Back to Home
              </a>
              <span className="text-gray-600">•</span>
              <a href="https://coldai.uk/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-orange-400 transition-colors">
                Privacy Policy
              </a>
              <span className="text-gray-600">•</span>
              <a href="https://coldai.uk/terms" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-orange-400 transition-colors">
                Terms
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpVerification && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
             style={{
               backgroundColor: 'rgba(0, 0, 0, 0.7)',
               backdropFilter: 'blur(4px)',
               WebkitBackdropFilter: 'blur(4px)'
             }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.95)'
            }}>
            <h3 className="text-xl font-bold text-white mb-2">Verify Your Email</h3>
            <p className="text-sm text-gray-400 mb-6">
              We sent a 6-digit verification code to <span className="text-orange-400">{verificationEmail}</span>
            </p>

            <form onSubmit={handleVerifyOtp}>
              <div className="space-y-2 mb-4">
                <Label htmlFor="otp-code" className="text-gray-300">Verification Code</Label>
                <Input
                  id="otp-code"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 text-center">
                  Enter the 6-digit code from your email
                </p>
              </div>

              <div className="flex gap-3 mb-4">
                <Button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    "Verify Email"
                  )}
                </Button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2">
                  Didn't receive the code?
                </p>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-sm text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50">
                  Resend Code
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpVerification(false);
                    setOtpCode("");
                  }}
                  className="text-sm text-gray-400 hover:text-orange-400 transition-colors">
                  ← Back to Sign In
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
             style={{
               backgroundColor: 'rgba(0, 0, 0, 0.7)',
               backdropFilter: 'blur(4px)',
               WebkitBackdropFilter: 'blur(4px)'
             }}
             onClick={() => setShowPasswordReset(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.95)'
            }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-2">Reset Password</h3>
            <p className="text-sm text-gray-400 mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formEmail = (e.target as HTMLFormElement).email.value;
              handlePasswordReset(formEmail);
            }}>
              <div className="space-y-2 mb-4">
                <Label htmlFor="reset-email" className="text-gray-300">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="reset-email"
                    name="email"
                    type="email"
                    defaultValue={email}
                    className="pl-10 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>

              {/* Turnstile CAPTCHA Widget */}
              <div className="space-y-2 mb-4">
                <Label className="text-gray-300">Verify you're human</Label>
                <div className="relative min-h-[65px] flex justify-center items-center">
                  {/* Loading spinner - shows while CAPTCHA loads */}
                  {!resetCaptchaToken && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                        <p className="text-xs text-gray-500">Loading verification...</p>
                      </div>
                    </div>
                  )}
                  {/* Turnstile widget container */}
                  <div
                    ref={resetTurnstileRef}
                    className="flex justify-center"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setShowPasswordReset(false)}
                  variant="outline"
                  className="flex-1 bg-gray-900/50 border-gray-700 text-gray-300 hover:bg-gray-800/50">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!resetCaptchaToken}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                  Send Reset Link
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
