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
