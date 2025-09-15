import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { ProfileWidget } from '@/components/widgets/ProfileWidget'
import { CompanyWidget } from '@/components/widgets/CompanyWidget'
import { CommunicationWidget } from '@/components/widgets/CommunicationWidget'
import { KnowledgeWidget } from '@/components/widgets/KnowledgeWidget'
import { ICPWidget } from '@/components/widgets/ICPWidget'
import { ProspectWidget } from '@/components/widgets/ProspectWidget'
import { AnalyticsWidget } from '@/components/widgets/AnalyticsWidget'
import { MessageWidget } from '@/components/widgets/MessageWidget'
import { UpgradeWidget } from '@/components/widgets/UpgradeWidget'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

export function WidgetDashboard() {
  const [activeWidget, setActiveWidget] = useState<string | null>(null)

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
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4 relative">
            <Zap className="w-8 h-8 text-primary" />
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold mb-3">
            Welcome to <span className="gradient-text">Cold AI Free</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Your AI-powered outreach assistant
          </p>
          <div className="mt-6 flex items-center justify-center gap-6">
            <div className="stat-card px-6 py-3">
              <p className="stat-value text-2xl">25</p>
              <p className="stat-label">Messages/Month</p>
            </div>
            <div className="stat-card px-6 py-3">
              <p className="stat-value text-2xl">1</p>
              <p className="stat-label">ICP Profile</p>
            </div>
            <div className="stat-card px-6 py-3">
              <p className="stat-value text-2xl">∞</p>
              <p className="stat-label">Possibilities</p>
            </div>
          </div>
        </motion.div>

        {/* Widget Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-min"
        >
          <motion.div variants={itemVariants}>
            <ProfileWidget 
              isActive={activeWidget === 'profile'}
              onActivate={() => setActiveWidget(activeWidget === 'profile' ? null : 'profile')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <CompanyWidget 
              isActive={activeWidget === 'company'}
              onActivate={() => setActiveWidget(activeWidget === 'company' ? null : 'company')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <CommunicationWidget 
              isActive={activeWidget === 'communication'}
              onActivate={() => setActiveWidget(activeWidget === 'communication' ? null : 'communication')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <KnowledgeWidget 
              isActive={activeWidget === 'knowledge'}
              onActivate={() => setActiveWidget(activeWidget === 'knowledge' ? null : 'knowledge')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <ICPWidget 
              isActive={activeWidget === 'icp'}
              onActivate={() => setActiveWidget(activeWidget === 'icp' ? null : 'icp')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <ProspectWidget 
              isActive={activeWidget === 'prospects'}
              onActivate={() => setActiveWidget(activeWidget === 'prospects' ? null : 'prospects')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <AnalyticsWidget 
              isActive={activeWidget === 'analytics'}
              onActivate={() => setActiveWidget(activeWidget === 'analytics' ? null : 'analytics')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <MessageWidget 
              isActive={activeWidget === 'messages'}
              onActivate={() => setActiveWidget(activeWidget === 'messages' ? null : 'messages')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <UpgradeWidget 
              isActive={activeWidget === 'upgrade'}
              onActivate={() => setActiveWidget(activeWidget === 'upgrade' ? null : 'upgrade')}
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