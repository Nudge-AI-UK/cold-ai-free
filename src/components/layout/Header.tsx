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

          {/* Navigation Links - Clean Tab Style */}
          <div className="flex items-center space-x-1">
            <Link to="/">
              <div className={`px-4 py-2 relative group cursor-pointer transition-all duration-200 ${
                location.pathname === '/'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}>
                <span className="font-medium">Dashboard</span>
                {location.pathname === '/' && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #FBAE1C 100%)',
                    }}
                  />
                )}
              </div>
            </Link>
            <Link to="/outreach">
              <div className={`px-4 py-2 relative group cursor-pointer transition-all duration-200 flex items-center gap-2 ${
                location.pathname === '/outreach'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}>
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">Outreach</span>
                {location.pathname === '/outreach' && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #FBAE1C 100%)',
                    }}
                  />
                )}
              </div>
            </Link>
          </div>
        </div>
        
        <div className="ml-auto flex items-center space-x-3">
          {/* Upgrade Button - Gradient */}
          <button
            onClick={() => window.open(import.meta.env.VITE_UPGRADE_URL || 'https://app.coldai.uk', '_blank')}
            className="px-5 py-2 rounded-lg font-semibold text-white transition-all duration-200 hover:shadow-lg hover:scale-105"
            style={{
              background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 100%)',
            }}
          >
            Upgrade to Pro
          </button>

          {/* Profile Dropdown - Clean Circle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 text-gray-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                <User className="h-4 w-4" />
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
