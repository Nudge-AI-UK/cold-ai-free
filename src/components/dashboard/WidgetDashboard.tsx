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

        {/* Widget Grid - 4 column grid with custom row heights */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-4 gap-4"
          style={{
            gridTemplateRows: 'repeat(5, minmax(120px, 1fr))', // 5 rows with min height
            minHeight: '600px'
          }}
        >
          {/* Left Column - ICP (1x2 tall - spans 4 row units) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-1 row-span-4"
            style={{ minHeight: '500px' }}
          >
            <div className="h-full">
              <ICPWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Center - Message Gen (2x1.5 - spans 2 cols, 3 row units) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-2 row-span-3"
            style={{ minHeight: '380px' }}
          >
            <div className="h-full">
              <MessageWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Right Column - Prospects (1x2 tall - spans 4 row units) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-1 row-span-4"
            style={{ minHeight: '500px' }}
          >
            <div className="h-full">
              <ProspectWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Under Message Gen Left - Analytics (1x0.5 - 1 row unit) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-1 row-span-1"
            style={{ minHeight: '120px' }}
          >
            <div className="h-full">
              <AnalyticsWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Under Message Gen Right - LinkedIn (1x0.5 - 1 row unit) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-1 row-span-1"
            style={{ minHeight: '120px' }}
          >
            <div className="h-full">
              <LinkedInWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Bottom Left - Knowledge (2x1 - spans 2 cols, 1 row unit) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-2 row-span-1"
            style={{ minHeight: '240px' }}
          >
            <div className="h-full">
              <KnowledgeWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Bottom Right - Settings (2x1 - spans 2 cols, 1 row unit) */}
          <motion.div 
            variants={itemVariants} 
            className="col-span-2 row-span-1"
            style={{ minHeight: '240px' }}
          >
            <div className="h-full">
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
