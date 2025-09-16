import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Target, MoreVertical, Plus, Edit2, Eye, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ICPCreationModalV2 } from '@/components/states/ICPCreationModalV2'
import { ICPUnifiedModal } from '@/components/states/ICPUnifiedModal'

interface ICPWidgetProps {
  className?: string
}

type ICPState = 'empty' | 'generating' | 'draft' | 'reviewing' | 'active'

export function ICPWidget({ className }: ICPWidgetProps) {
  const { user } = useAuth()
  const [icp, setIcp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [icpState, setIcpState] = useState<ICPState>('empty')
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false)
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false)

  useEffect(() => {
    if (user) {
      fetchICP()
    }
  }, [user])

  const fetchICP = async () => {
    if (!user) return
    
    setLoading(true)
    const { data } = await supabase
      .from('icps')
      .select('*')
      .eq('created_by', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (data) {
      setIcp(data)
      // Determine ICP state based on workflow_status and review_status
      if (data.workflow_status === 'generating') {
        setIcpState('generating')
      } else if (data.workflow_status === 'processing' || data.workflow_status === 'reviewing') {
        setIcpState('reviewing')
      } else if (data.workflow_status === 'approved' && data.review_status === 'approved') {
        setIcpState('active')
      } else if (data.workflow_status === 'draft' || !data.workflow_status) {
        setIcpState('draft')
      } else {
        setIcpState('active')
      }
    } else {
      setIcpState('empty')
    }
    setLoading(false)
  }

  // Get quality scores from metadata or use defaults
  const qualityScores = icp?.metadata?.ai_feedback?.quality_assessment?.scores || {
    completeness: 0,
    specificity: 0,
    overall: 0
  }

  const handleCreateClick = () => {
    setIsCreationModalOpen(true)
  }

  const handleViewDetails = () => {
    setIsUnifiedModalOpen(true)
  }

  const handleEditApprove = () => {
    setIsUnifiedModalOpen(true)
  }

  const getStatusBadge = () => {
    switch (icpState) {
      case 'active':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case 'generating':
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Generating
          </Badge>
        )
      case 'reviewing':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Reviewing
          </Badge>
        )
      case 'draft':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Draft
          </Badge>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card className={`bg-gray-800/50 border-gray-700 ${className}`}>
        <CardContent className="flex items-center justify-center h-full min-h-[200px]">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={`bg-gray-800/50 border-gray-700 hover:border-orange-500/50 transition-all ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">ICP</h3>
                {getStatusBadge()}
              </div>
            </div>
            {icpState === 'active' && (
              <button className="text-gray-400 hover:text-white transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* State-based content */}
          {icpState === 'empty' && (
            <>
              <p className="text-sm text-gray-400">Define your ideal customer</p>
              <p className="text-xs text-gray-500">Free: 1 profile allowed</p>
              <Button 
                onClick={handleCreateClick}
                size="sm"
                className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] hover:opacity-90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create ICP
              </Button>
            </>
          )}

          {icpState === 'generating' && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-gray-300 font-medium">{icp?.icp_name || 'Creating ICP...'}</p>
                <p className="text-xs text-gray-400">AI is generating your customer profile</p>
              </div>
              <Progress 
                value={66} 
                className="h-1.5 bg-gray-700"
                indicatorClassName="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] animate-pulse"
              />
              <p className="text-xs text-gray-500">This may take a few moments...</p>
            </>
          )}

          {icpState === 'draft' && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-gray-300 font-medium line-clamp-1">{icp?.icp_name}</p>
                <p className="text-xs text-gray-400 line-clamp-2">{icp?.description}</p>
              </div>
              {icp?.metadata?.ai_feedback && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
                  <p className="text-xs text-yellow-400">AI suggestions available</p>
                </div>
              )}
              <Button 
                onClick={handleEditApprove}
                size="sm"
                className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] hover:opacity-90"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit & Approve
              </Button>
            </>
          )}

          {icpState === 'reviewing' && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-gray-300 font-medium line-clamp-1">{icp?.icp_name}</p>
                <p className="text-xs text-gray-400">AI is reviewing your approved changes</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <p className="text-xs text-blue-300">Processing...</p>
                </div>
              </div>
              <Button 
                onClick={handleViewDetails}
                size="sm"
                variant="outline"
                className="w-full border-gray-600"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </>
          )}

          {icpState === 'active' && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-gray-300 font-medium line-clamp-1">{icp?.icp_name}</p>
                {icp?.updated_at && (
                  <p className="text-xs text-gray-500">
                    Last used: {formatDistanceToNow(new Date(icp.updated_at), { addSuffix: true })}
                  </p>
                )}
                <p className="text-xs text-gray-400">Product: Cold AI Free</p>
              </div>

              {/* Mini Quality Assessment */}
              {qualityScores.overall > 0 && (
                <div className="bg-black/20 rounded-lg p-2 space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Quality</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Complete</p>
                      <p className="text-sm font-bold text-[#FBAE1C]">{qualityScores.completeness}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Specific</p>
                      <p className="text-sm font-bold text-[#FC9109]">{qualityScores.specificity}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Overall</p>
                      <p className="text-sm font-bold text-[#DD6800]">{qualityScores.overall}%</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ICPCreationModalV2
        isOpen={isCreationModalOpen}
        onClose={() => {
          setIsCreationModalOpen(false)
          fetchICP() // Refresh after creation
        }}
        onSuccess={() => {
          fetchICP() // Refresh after success
        }}
        onGenerate={(icpData) => {
          // Handle generation start
          setIcpState('generating')
        }}
      />

      {icp && (
        <ICPUnifiedModal
          isOpen={isUnifiedModalOpen}
          onClose={() => {
            setIsUnifiedModalOpen(false)
            fetchICP() // Refresh after closing
          }}
          icp={icp}
          onUpdate={() => {
            fetchICP() // Refresh after update
          }}
        />
      )}
    </>
  )
}
