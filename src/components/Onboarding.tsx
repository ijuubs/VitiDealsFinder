import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { ShoppingCart, Search, Camera, ArrowRight, Check, Palmtree } from 'lucide-react';

const steps = [
  {
    title: "Bula! Welcome to Fiji Deals",
    description: "Your ultimate companion for smart shopping across Fiji's supermarkets. Find the best prices and save money every week.",
    icon: <Palmtree className="w-16 h-16 text-emerald-500" />,
    color: "bg-emerald-50 text-emerald-900"
  },
  {
    title: "Compare & Save",
    description: "Search for products across MH, RB Patel, Extra, and more. Compare prices instantly and build your smart shopping list.",
    icon: <Search className="w-16 h-16 text-blue-500" />,
    color: "bg-blue-50 text-blue-900"
  },
  {
    title: "AI-Powered Flyers",
    description: "We automatically extract deals from weekly supermarket flyers using advanced AI, so you never miss a special.",
    icon: <Camera className="w-16 h-16 text-purple-500" />,
    color: "bg-purple-50 text-purple-900"
  },
  {
    title: "Ready to Shop?",
    description: "Create an account to save your shopping lists, track your savings, and get personalized deal alerts.",
    icon: <ShoppingCart className="w-16 h-16 text-orange-500" />,
    color: "bg-orange-50 text-orange-900"
  }
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const completeOnboarding = useAppStore(state => state.completeOnboarding);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden relative flex flex-col h-[600px] max-h-[90vh]"
      >
        {/* Skip button */}
        <button 
          onClick={skipOnboarding}
          className="absolute top-6 right-6 z-10 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
        >
          Skip
        </button>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`absolute inset-0 flex flex-col items-center justify-center p-8 text-center ${steps[currentStep].color}`}
            >
              <div className="bg-white p-6 rounded-full shadow-lg mb-8 transform transition-transform hover:scale-105">
                {steps[currentStep].icon}
              </div>
              <h2 className="text-3xl font-black font-display mb-4 tracking-tight">
                {steps[currentStep].title}
              </h2>
              <p className="text-lg font-medium opacity-80 leading-relaxed max-w-sm">
                {steps[currentStep].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Area */}
        <div className="p-8 bg-white border-t border-slate-100 flex flex-col items-center gap-6">
          {/* Progress Dots */}
          <div className="flex gap-2">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-8 bg-emerald-600' : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Action Button */}
          <button
            onClick={nextStep}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 group"
          >
            {currentStep === steps.length - 1 ? (
              <>
                Get Started <Check className="w-5 h-5" />
              </>
            ) : (
              <>
                Continue <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
