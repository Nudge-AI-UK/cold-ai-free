import { useAuth } from '@/hooks/useAuth'
import { LogOut, User, MessageSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

export function Header() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  return (
    <header
      className="sticky top-0 z-50 w-full backdrop-blur"
      style={{
        backgroundColor: '#0C1725',
        borderBottom: '2px solid #FC9109'
      }}
    >
      <div className="container flex h-16 items-center">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <Link to="/">
              <img
                src="/Cold_AI_Logo_Rectangle.png"
                alt="Cold AI"
                className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>

            {/* Animated FREE text */}
            <div
              className="text-xl font-bold relative"
              style={{
                background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 20%, #FFD700 40%, #FC9109 60%, #FBAE1C 80%, #FC9109 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'shimmer 3s linear infinite',
                letterSpacing: '0.1em'
              }}
            >
              FREE
              {/* Sparkle effect */}
              <span
                className="absolute -top-1 -right-2 text-yellow-400"
                style={{
                  animation: 'sparkle 2s ease-in-out infinite',
                  fontSize: '12px'
                }}
              >
                ✨
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-gray-600" />

          <Badge
            variant="secondary"
            className="bg-orange-500/10 text-orange-400 border-orange-500/20"
          >
            25 messages/month
          </Badge>

          <div className="h-6 w-px bg-gray-600" />

          {/* Navigation Links */}
          <div className="flex items-center space-x-2">
            <Link to="/">
              <Badge
                variant="secondary"
                className={`${
                  location.pathname === '/'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                    : 'bg-white/5 text-gray-400 border-white/10'
                } hover:bg-orange-500/20 hover:border-orange-500/30 hover:text-orange-300 transition-all cursor-pointer`}
              >
                Dashboard
              </Badge>
            </Link>
            <Link to="/inbox">
              <Badge
                variant="secondary"
                className={`flex items-center gap-1 ${
                  location.pathname === '/inbox'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                    : 'bg-white/5 text-gray-400 border-white/10'
                } hover:bg-orange-500/20 hover:border-orange-500/30 hover:text-orange-300 transition-all cursor-pointer`}
              >
                <MessageSquare className="h-3 w-3" />
                Inbox
              </Badge>
            </Link>
          </div>
        </div>
        
        <div className="ml-auto flex items-center space-x-4">
          {/* Upgrade Badge - styled consistently */}
          <button
            onClick={() => window.open(import.meta.env.VITE_UPGRADE_URL || 'https://app.coldai.uk', '_blank')}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
          >
            <Badge 
              variant="secondary"
              className="bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/30 hover:text-orange-300 transition-all cursor-pointer"
            >
              Upgrade to Pro
            </Badge>
          </button>
          
          {/* Profile Dropdown - matching badge style */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded">
                <Badge 
                  variant="secondary"
                  className="bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/30 hover:text-orange-300 transition-all cursor-pointer px-2 py-1"
                >
                  <User className="h-4 w-4" />
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#0C1725] border-orange-500/30">
              <DropdownMenuLabel className="text-gray-400">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-orange-500/20" />
              <DropdownMenuItem 
                onClick={() => signOut()}
                className="hover:bg-orange-500/20 cursor-pointer text-gray-200 focus:bg-orange-500/20 focus:text-orange-300"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* CSS animations defined in global CSS */}
    </header>
  )
}
