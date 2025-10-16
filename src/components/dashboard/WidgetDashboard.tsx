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
import { AlertTriangle, X } from 'lucide-react'

export function WidgetDashboard() {
  const forceEmptyState = false  // TEST FLAG REMOVE WHEN NEEDED
  const [showMaintenanceBanner, setShowMaintenanceBanner] = useState(() => {
    // Check localStorage on mount
    const dismissed = localStorage.getItem('maintenance_banner_dismissed')
    return dismissed !== 'true'
  })

  const handleDismissBanner = () => {
    localStorage.setItem('maintenance_banner_dismissed', 'true')
    setShowMaintenanceBanner(false)
  }

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
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0C1725 0%, #1a1f36 100%)' }}>
      <Header />

      {/* Scheduled Maintenance Banner */}
      {showMaintenanceBanner && (
        <div className="bg-orange-500/10 border-b border-orange-500/30 backdrop-blur-sm">
          <div className="max-w-[1400px] mx-auto px-6 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-orange-400 text-sm font-medium">
                  Scheduled Maintenance
                </p>
                <p className="text-orange-300/80 text-xs">
                  The site will be offline on Friday 17th October at 14:00 for scheduled maintenance. The service may not be back online until Monday 20th October. We apologise for any inconvenience.
                </p>
              </div>
              <button
                onClick={handleDismissBanner}
                className="p-1 rounded-lg hover:bg-orange-500/20 text-orange-400 transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="px-6 py-6 max-w-[1400px] mx-auto">
        
        {/* Widget Grid - Using CSS Grid with specific areas */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gridTemplateRows: 'auto auto auto auto',
            gridTemplateAreas: `
              "icp message message prospects"
              "icp message message prospects"
              "icp analytics linkedin prospects"
              "knowledge knowledge settings settings"
            `,
            gap: '16px'
          }}
        >
          {/* ICP Widget - Left tall */}
          <motion.div 
            variants={itemVariants}
            style={{ gridArea: 'icp' }}
          >
            <div className="h-full min-h-[400px]">
              <ICPWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Message Generation - Center top */}
          <motion.div 
            variants={itemVariants}
            style={{ gridArea: 'message' }}
          >
            <div className="h-full min-h-[300px]">
              <MessageWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Prospects Widget - Right tall */}
          <motion.div 
            variants={itemVariants}
            style={{ gridArea: 'prospects' }}
          >
            <div className="h-full min-h-[400px]">
              <ProspectWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Analytics - Small under message left */}
          <motion.div 
            variants={itemVariants}
            style={{ gridArea: 'analytics' }}
          >
            <div className="h-full min-h-[120px]">
              <AnalyticsWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* LinkedIn - Small under message right */}
          <motion.div 
            variants={itemVariants}
            style={{ gridArea: 'linkedin' }}
          >
            <div className="h-full min-h-[120px]">
              <LinkedInWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Knowledge Widget - Bottom left */}
          <motion.div 
            variants={itemVariants}
            style={{ gridArea: 'knowledge' }}
          >
            <div className="h-full min-h-[200px]">
              <KnowledgeWidget 
                forceEmpty={forceEmptyState}
                className="h-full"
              />
            </div>
          </motion.div>
          
          {/* Settings Widget - Bottom right */}
          <motion.div 
            variants={itemVariants}
            style={{ gridArea: 'settings' }}
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
