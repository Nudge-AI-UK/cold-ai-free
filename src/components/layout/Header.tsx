import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { LogOut, Zap, User } from 'lucide-react'
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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-9 h-9 bg-primary/10 rounded-xl relative">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-lg">Cold AI Free</span>
          </div>
          <div className="h-6 w-px bg-border" />
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            Free Tier • 25 messages/month
          </Badge>
        </div>
        
        <div className="ml-auto flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            className="border-primary/20 hover:border-primary/40 hover:bg-primary/5"
            onClick={() => window.open(import.meta.env.VITE_UPGRADE_URL || 'https://app.coldai.uk', '_blank')}
          >
            Upgrade to Pro
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <User className="h-5 w-5" />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              <DropdownMenuLabel className="text-muted-foreground">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem 
                onClick={() => signOut()}
                className="hover:bg-primary/10 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}