import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor } from 'lucide-react';

export function MobileBlocker() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check both screen size and user agent
      const mobileWidth = window.innerWidth < 768;
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(mobileWidth || mobileUA);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900 overflow-hidden flex items-center justify-center">
      {/* Animated Background - Same as login screen */}
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

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-md mx-auto px-6"
      >
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="mb-8 text-center">
            <img
              src="/Cold_AI_Logo_Rectangle_Transparent.png"
              alt="Cold AI"
              className="w-48 mx-auto mb-6"
            />
          </div>

          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full blur-lg opacity-50"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-orange-500/20 to-amber-500/20 backdrop-blur-sm border border-orange-500/20 rounded-full flex items-center justify-center">
                <Monitor className="w-10 h-10 text-orange-400" />
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-3">
              Desktop Only
            </h1>
            <p className="text-gray-400 leading-relaxed">
              Cold AI is currently optimised for desktop use only. Please access the platform from a desktop or laptop computer for the best experience.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400 text-center">
              <span className="text-orange-400 font-semibold">Mobile support coming soon!</span>
              <br />
              We're working on a mobile-optimised experience.
            </p>
          </div>

          {/* Contact */}
          <p className="text-sm text-gray-500 text-center">
            Need help?{' '}
            <a
              href="mailto:admin@coldai.com"
              className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
