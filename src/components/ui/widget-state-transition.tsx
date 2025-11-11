import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface WidgetStateTransitionProps {
  children: ReactNode;
  /** Unique key that triggers re-animation when changed (e.g., message status, widget state) */
  stateKey: string | number;
  /** Animation variant - 'pop' gives a satisfying scale effect */
  variant?: 'pop' | 'fade' | 'slide';
  /** Duration in seconds */
  duration?: number;
  /** Custom className for the wrapper */
  className?: string;
}

/**
 * WidgetStateTransition - Animates widget content when state changes
 *
 * Usage:
 * ```tsx
 * <WidgetStateTransition stateKey={messageStatus} variant="pop">
 *   <YourWidgetContent />
 * </WidgetStateTransition>
 * ```
 *
 * Change the `stateKey` prop to trigger re-animation.
 * Perfect for message generation, status changes, or any state transitions.
 */
const animationVariants = {
  pop: {
    initial: {
      scale: 0,
      opacity: 0,
      rotate: -5
    },
    animate: {
      scale: 1,
      opacity: 1,
      rotate: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 15,
        mass: 0.8,
      }
    },
    exit: {
      scale: 0,
      opacity: 0,
      rotate: 5,
      transition: {
        duration: 0.4,
        ease: [0.43, 0.13, 0.23, 0.96]
      }
    }
  },
  fade: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.3 }
    },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  },
  slide: {
    initial: { y: 10, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
      }
    },
    exit: { y: -10, opacity: 0, transition: { duration: 0.2 } }
  }
};

export const WidgetStateTransition = ({
  children,
  stateKey,
  variant = 'pop',
  className = '',
}: WidgetStateTransitionProps) => {
  const animation = animationVariants[variant];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stateKey}
        initial={animation.initial}
        animate={animation.animate}
        exit={animation.exit}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * STANDALONE DEMO FOR CODEPEN TESTING
 *
 * Copy the code below to test in CodePen:
 *
 * HTML:
 * <div id="root"></div>
 *
 * Add these CDN scripts:
 * - React: https://unpkg.com/react@18/umd/react.development.js
 * - ReactDOM: https://unpkg.com/react-dom@18/umd/react-dom.development.js
 * - Framer Motion: https://unpkg.com/framer-motion@11/dist/framer-motion.js
 *
 * JavaScript (Babel):
 */

// CODEPEN DEMO CODE - Copy everything below this line for testing:
/*

const { motion, AnimatePresence } = window.FramerMotion;

const animationVariants = {
  pop: {
    initial: { scale: 0.95, opacity: 0 },
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }
    },
    exit: { scale: 0.95, opacity: 0, transition: { duration: 0.15 } }
  },
  fade: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.3 }
    },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  },
  slide: {
    initial: { y: 10, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
      }
    },
    exit: { y: -10, opacity: 0, transition: { duration: 0.2 } }
  }
};

const WidgetStateTransition = ({ children, stateKey, variant = 'pop' }) => {
  const animation = animationVariants[variant];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stateKey}
        initial={animation.initial}
        animate={animation.animate}
        exit={animation.exit}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Demo Component
const Demo = () => {
  const [status, setStatus] = React.useState('generated');
  const [variant, setVariant] = React.useState('pop');

  const statuses = ['generated', 'analyzing', 'sending', 'sent'];
  const variants = ['pop', 'fade', 'slide'];

  const getStatusColor = (s) => {
    switch(s) {
      case 'generated': return '#FBAE1C';
      case 'analyzing': return '#3B82F6';
      case 'sending': return '#8B5CF6';
      case 'sent': return '#10B981';
      default: return '#6B7280';
    }
  };

  const nextStatus = () => {
    const currentIndex = statuses.indexOf(status);
    const nextIndex = (currentIndex + 1) % statuses.length;
    setStatus(statuses[nextIndex]);
  };

  return (
    <div style={{
      padding: '40px',
      background: 'linear-gradient(135deg, #0a0f1b 0%, #1a1f2e 100%)',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ color: 'white', marginBottom: '30px', textAlign: 'center' }}>
          Widget State Transition Demo
        </h1>

        <div style={{
          background: 'rgba(31, 41, 55, 0.8)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#9CA3AF', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              Animation Variant:
            </label>
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1F2937',
                color: 'white',
                border: '1px solid #374151',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {variants.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <button
            onClick={nextStatus}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(to right, #FBAE1C, #FC9109)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
          >
            Change State (Trigger Animation)
          </button>
        </div>

        <WidgetStateTransition stateKey={status} variant={variant}>
          <div style={{
            background: 'rgba(31, 41, 55, 0.8)',
            padding: '30px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              background: getStatusColor(status),
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px'
            }}>
              {status === 'generated' && '✨'}
              {status === 'analyzing' && '🔍'}
              {status === 'sending' && '📤'}
              {status === 'sent' && '✅'}
            </div>

            <h3 style={{
              color: 'white',
              fontSize: '20px',
              marginBottom: '8px',
              fontWeight: '600'
            }}>
              Message Status
            </h3>

            <p style={{
              color: '#9CA3AF',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              Current state: <span style={{
                color: getStatusColor(status),
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {status}
              </span>
            </p>

            <div style={{
              padding: '15px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              color: '#D1D5DB',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              This widget content animates with a subtle "{variant}" effect
              whenever the state changes. Perfect for message generation,
              status updates, or any state transition!
            </div>
          </div>
        </WidgetStateTransition>

        <p style={{
          color: '#6B7280',
          textAlign: 'center',
          marginTop: '30px',
          fontSize: '14px'
        }}>
          Click the button above to see the animation in action
        </p>
      </div>
    </div>
  );
};

ReactDOM.render(<Demo />, document.getElementById('root'));

*/
