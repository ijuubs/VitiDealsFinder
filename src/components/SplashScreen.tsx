import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Sun, Palmtree } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 800); // Wait for exit animation
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 overflow-hidden"
        >
          {/* Decorative background elements */}
          <div className="absolute top-10 left-10 opacity-20">
            <Sun className="w-32 h-32 text-yellow-300 animate-pulse" />
          </div>
          <div className="absolute bottom-10 right-10 opacity-20">
            <Palmtree className="w-40 h-40 text-emerald-900" />
          </div>
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.8, 
              ease: "easeOut",
              delay: 0.2
            }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-white/30 blur-2xl rounded-full"></div>
              <div className="bg-white p-6 rounded-3xl shadow-2xl relative transform rotate-3">
                <ShoppingBag className="w-16 h-16 text-emerald-600" />
              </div>
            </div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-5xl font-black text-white font-display tracking-tight text-center mb-2 drop-shadow-lg"
            >
              Fiji Deals
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="text-emerald-50 text-lg font-medium tracking-wide"
            >
              Smart Shopping in Paradise
            </motion.p>
          </motion.div>

          {/* Loading indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="absolute bottom-20 flex gap-2"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ 
                  y: [0, -10, 0],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 1, 
                  repeat: Infinity, 
                  delay: i * 0.2 
                }}
                className="w-3 h-3 bg-white rounded-full"
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
