import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Mail, Lock, ArrowRight, Zap, Brain, Target, MessageSquare, Chrome } from "lucide-react";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`,
            data: {
              full_name: email.split('@')[0], // Default name from email
            }
          },
        });

        if (error) throw error;

        toast.success("Success! Check your email to confirm your account.");
        setIsLoading(false);
      } else {
        console.log('🔐 Attempting login for:', email);

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('❌ Login error:', error);
          throw error;
        }

        // Success - the AuthContext will handle updating the user state
        // and the App will automatically show the dashboard
        console.log('✅ Login successful');
        toast.success("Welcome back!");
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
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

  const features = [
    { icon: Brain, text: "AI-Powered Messages", color: "from-purple-500 to-pink-500" },
    { icon: Target, text: "Smart ICP Targeting", color: "from-blue-500 to-cyan-500" },
    { icon: MessageSquare, text: "Personalised Outreach", color: "from-green-500 to-emerald-500" },
    { icon: Zap, text: "Instant Generation", color: "from-orange-500 to-amber-500" }
  ];

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-orange-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-blue-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [-50, 50, -50],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 bg-purple-500/10 rounded-full blur-3xl"
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
                <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 backdrop-blur-sm border border-orange-500/20">
                  <Sparkles className="w-8 h-8 text-orange-400" />
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
                    <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} rounded-lg blur-md opacity-0 group-hover:opacity-50 transition-opacity`}></div>
                    <div className="relative flex items-center gap-2 p-3 rounded-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700 group-hover:border-gray-600 transition-colors">
                      <feature.icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">{feature.text}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex gap-6 pt-4">
                <div>
                  <p className="text-2xl font-bold text-white">10x</p>
                  <p className="text-sm text-gray-400">Faster Outreach</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">85%</p>
                  <p className="text-sm text-gray-400">Response Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">500+</p>
                  <p className="text-sm text-gray-400">Happy Users</p>
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
            <Card className="bg-gray-800/50 backdrop-blur-xl border-gray-700 shadow-2xl">
              <CardHeader className="space-y-1 pb-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-white">
                    {isSignUp ? "Create Account" : "Welcome Back"}
                  </CardTitle>
                  <div className="md:hidden p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                    <Sparkles className="w-5 h-5 text-orange-400" />
                  </div>
                </div>
                <CardDescription className="text-gray-400">
                  {isSignUp
                    ? "Start your journey to smarter outreach"
                    : "Enter your credentials to continue"}
                </CardDescription>
              </CardHeader>

              <CardContent>
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

                  <Button
                    type="submit"
                    disabled={isLoading}
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

                <div className="mt-6 text-center">
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
                </div>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-gray-800 px-2 text-gray-500">Or continue with</span>
                  </div>
                </div>

                {/* Google Login Only */}
                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full bg-gray-900/50 border-gray-700 text-gray-300 hover:bg-gray-800/50 hover:border-orange-500/50 hover:text-white transition-all group"
                >
                  <div className="flex items-center justify-center gap-3">
                    <Chrome className="w-5 h-5 group-hover:text-orange-400 transition-colors" />
                    <span>Continue with Google</span>
                  </div>
                </Button>

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
              <a href="/" className="text-gray-400 hover:text-orange-400 transition-colors">
                Back to Home
              </a>
              <span className="text-gray-600">•</span>
              <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">
                Privacy Policy
              </a>
              <span className="text-gray-600">•</span>
              <a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">
                Terms
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
