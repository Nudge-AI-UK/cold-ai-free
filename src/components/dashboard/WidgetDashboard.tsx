import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { KnowledgeWidget } from '@/components/widgets/KnowledgeWidget'
import { ICPWidget } from '@/components/widgets/ICPWidget'
import { AnalyticsWidget } from '@/components/widgets/AnalyticsWidget'
import { MessageWidget } from '@/components/widgets/MessageWidget'
import { LinkedInWidget } from '@/components/widgets/LinkedInWidget'
import { ProspectWidget } from '@/components/widgets/ProspectWidget'
import { SettingsWidget } from '@/components/widgets/SettingsWidget' // ADD THIS IMPORT
import { motion } from 'framer-motion'

export function WidgetDashboard() {
  const forceEmptyState = true  // TEST FLAG REMOVE WHEN NEEDED

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Minimal Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-3">
            {/* Placeholder for logo */}
            <span className="text-2xl">🚀</span>
          </div>
          <h1 className="text-2xl font-bold">
            <span className="gradient-text">Cold AI</span> Dashboard
          </h1>
        </motion.div>

        {/* Widget Grid - Based on your sketch */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 lg:grid-cols-4 auto-rows-min"
        >
          {/* Row 1 - Knowledge, ICP, Usage */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <KnowledgeWidget 
              forceEmpty={forceEmptyState}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <ICPWidget 
              forceEmpty={forceEmptyState}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <AnalyticsWidget 
              forceEmpty={forceEmptyState}
            />
          </motion.div>
          
          {/* Row 2 - Message Gen, LinkedIn Status */}
          <motion.div variants={itemVariants} className="lg:col-span-3">
            <MessageWidget 
              forceEmpty={forceEmptyState}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <LinkedInWidget 
              forceEmpty={forceEmptyState}
            />
          </motion.div>
          
          {/* Row 3 - Settings, Prospects */}
          <motion.div variants={itemVariants}>
            <SettingsWidget 
              forceEmpty={forceEmptyState}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <ProspectWidget 
              forceEmpty={forceEmptyState}
            />
          </motion.div>
        </motion.div>
      </main>

      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>
    </div>
  )
}
