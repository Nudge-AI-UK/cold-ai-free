import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { KnowledgeWidget } from '@/components/widgets/KnowledgeWidget'
import { ICPWidget } from '@/components/widgets/ICPWidget'
import { AnalyticsWidget } from '@/components/widgets/AnalyticsWidget'
import { MessageWidget } from '@/components/widgets/MessageWidget'
import { LinkedInWidget } from '@/components/widgets/LinkedInWidget'
import { ProspectWidget } from '@/components/widgets/ProspectWidget'
import { SettingsWidget } from '@/components/widgets/SettingsWidget'
import { motion } from 'framer-motion'

export function WidgetDashboard() {
  const forceEmptyState = true  // TEST FLAG REMOVE WHEN NEEDED

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
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
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0A0E1B 0%, #1a1f36 100%)' }}>
      <Header />
      
      <main className="px-6 py-6 max-w-[1400px] mx-auto">
        {/* Minimal Title */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6"
        >
          <p className="text-sm text-gray-400">Free Account: 25 Messages/Month</p>
        </motion.div>

        {/* Widget Grid - 4 column grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-4 gap-4 auto-rows-[minmax(150px,auto)]"
        >
          {/* Row 1 & 2: ICP (tall) | Message Gen (tall center) | Prospects (tall) */}
          
          {/* Left Column - ICP (1x2 tall) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-1 row-span-2"
          >
            <div className="h-full min-h-[400px]">
              <ICPWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Center Top - Message Gen (2x1.5 - taller) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-2 row-start-1 row-end-3"
            style={{ gridRowEnd: 'span 1.5' }}
          >
            <div className="h-full min-h-[300px]">
              <MessageWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Right Column - Prospects (1x2 tall) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-1 row-span-2"
          >
            <div className="h-full min-h-[400px]">
              <ProspectWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Row 2 partial: Analytics & LinkedIn under Message Gen */}
          
          {/* Analytics (small square) */}
          <motion.div 
            variants={itemVariants} 
            className="col-start-2 col-span-1"
            style={{ marginTop: '-50px' }}
          >
            <div className="h-full min-h-[100px]">
              <AnalyticsWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* LinkedIn (small square) */}
          <motion.div 
            variants={itemVariants} 
            className="col-start-3 col-span-1"
            style={{ marginTop: '-50px' }}
          >
            <div className="h-full min-h-[100px]">
              <LinkedInWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Row 3: Knowledge & Settings (landscape) */}
          
          {/* Knowledge (2x1 landscape) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-2"
          >
            <div className="h-full min-h-[200px]">
              <KnowledgeWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Settings (2x1 landscape) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-2"
          >
            <div className="h-full min-h-[200px]">
              <SettingsWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
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
