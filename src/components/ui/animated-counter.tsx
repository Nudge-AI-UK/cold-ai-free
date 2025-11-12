import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useMotionValue, animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter = ({ value, duration = 1000, className = '' }: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const springValue = useSpring(value, {
    damping: 30,
    stiffness: 100,
  });

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      setDisplayValue(Math.floor(latest));
    });

    return () => unsubscribe();
  }, [springValue]);

  // Format number with commas
  const formattedValue = displayValue.toLocaleString();

  return (
    <span className={className}>
      {formattedValue}
    </span>
  );
};

interface TickerCounterProps {
  value: number;
  className?: string;
  digitClassName?: string;
}

export const TickerCounter = ({ value, className = '', digitClassName = '' }: TickerCounterProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const motionValue = useMotionValue(0);

  useEffect(() => {
    // Calculate dynamic duration based on number magnitude
    // Base duration: 2 seconds
    // Add 0.3 seconds per order of magnitude
    const magnitude = Math.max(1, Math.floor(Math.log10(value || 1)));
    const duration = 2 + magnitude * 0.3;

    if (isInitialLoad && value > 0) {
      // Initial spin-up animation with easing
      animate(motionValue, value, {
        duration: duration,
        ease: [0.25, 0.1, 0.25, 1], // Cubic bezier for acceleration then deceleration
        onUpdate: (latest) => {
          setDisplayValue(Math.floor(latest));
        },
        onComplete: () => {
          setIsInitialLoad(false);
        }
      });
    } else if (!isInitialLoad) {
      // Subsequent updates - quick animation
      animate(motionValue, value, {
        duration: 0.5,
        ease: 'easeOut',
        onUpdate: (latest) => {
          setDisplayValue(Math.floor(latest));
        }
      });
    }
  }, [value, isInitialLoad, motionValue]);

  // Format number with commas
  const formattedValue = displayValue.toLocaleString();

  return (
    <span className={className}>
      {formattedValue}
    </span>
  );
};
