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
  const forceEmptyState = false  // TEST FLAG REMOVE WHEN NEEDED

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
