import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, Check, ArrowRight, Zap, Users, BarChart, Palette } from 'lucide-react'
import { UPGRADE_URL } from '@/lib/constants'

interface UpgradeWidgetProps {
  isActive: boolean
  onActivate: () => void
}

const UPGRADE_FEATURES = [
  { icon: Zap, text: 'Unlimited messages per month', highlight: true },
  { icon: Users, text: 'Unlimited ICPs and prospects' },
  { icon: BarChart, text: 'Advanced analytics and insights' },
  { icon: Palette, text: 'Custom branding and templates' },
  { icon: Crown, text: 'Priority support and updates' },
]

const PLANS = [
  { name: 'Basic', price: '£29', messages: '500 messages' },
  { name: 'Standard', price: '£79', messages: '2,000 messages', popular: true },
  { name: 'Pro', price: '£199', messages: 'Unlimited messages' },
]

export function UpgradeWidget({ isActive, onActivate }: UpgradeWidgetProps) {
  const handleUpgrade = () => {
    window.open(UPGRADE_URL, '_blank')
  }

  if (!isActive) {
    return (
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow widget-fade-in bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200"
        onClick={onActivate}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Upgrade</CardTitle>
            </div>
            <Badge className="bg-gradient-to-r from-purple-600 to-blue-600">
              PRO
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unlock unlimited potential
          </p>
          <p className="text-xs text-purple-600 mt-1 font-medium">
            Remove all limits →
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-3 widget-fade-in overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Upgrade to Pro
            </CardTitle>
            <CardDescription>Unlock the full power of Cold AI</CardDescription>
          </div>
          <Crown className="h-8 w-8 text-purple-600" />
        </div>
      </CardHeader>
      <CardContent className="relative space-y-6">
        {/* Features List */}
        <div className="space-y-3">
          {UPGRADE_FEATURES.map((feature, index) => (
            <div 
              key={index} 
              className={`flex items-center gap-3 ${feature.highlight ? 'font-medium' : ''}`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                feature.highlight 
                  ? 'bg-gradient-to-br from-purple-600 to-blue-600' 
                  : 'bg-primary/10'
              }`}>
                <feature.icon className={`h-4 w-4 ${
                  feature.highlight ? 'text-white' : 'text-primary'
                }`} />
              </div>
              <span className="text-sm">{feature.text}</span>
              {feature.highlight && (
                <Badge variant="secondary" className="ml-auto">
                  Most Popular
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-3 gap-3">
          {PLANS.map((plan) => (
            <div 
              key={plan.name}
              className={`relative rounded-lg p-3 text-center ${
                plan.popular 
                  ? 'border-2 border-purple-600 bg-purple-50' 
                  : 'border bg-white'
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600">
                  Popular
                </Badge>
              )}
              <p className="font-semibold text-sm mt-1">{plan.name}</p>
              <p className="text-2xl font-bold mt-2">{plan.price}</p>
              <p className="text-xs text-muted-foreground">/month</p>
              <p className="text-xs mt-2">{plan.messages}</p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="space-y-3">
          <Button 
            onClick={handleUpgrade} 
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            size="lg"
          >
            Upgrade Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Cancel anytime • No hidden fees
            </p>
            <p className="text-xs font-medium text-purple-600">
              7-day money-back guarantee
            </p>
          </div>
        </div>

        {/* Testimonial */}
        <div className="rounded-lg bg-gradient-to-r from-purple-100 to-blue-100 p-4">
          <p className="text-sm italic text-gray-700">
            "Cold AI Pro transformed our outreach. We've 10x'd our response rates!"
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            - Sarah J., Sales Director
          </p>
        </div>
      </CardContent>
    </Card>
  )
}