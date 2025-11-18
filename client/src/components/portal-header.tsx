import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { LogOut, Menu, Users, LayoutDashboard, UserCircle } from 'lucide-react';
import { useState } from 'react';

interface PortalHeaderProps {
  title: string;
  role: 'admin' | 'technician' | 'customer';
  onSignOut: () => void;
  onSwitchPortal?: () => void;
  switchPortalLabel?: string;
  onProfileClick?: () => void;
}

export function PortalHeader({
  title,
  role,
  onSignOut,
  onSwitchPortal,
  switchPortalLabel,
  onProfileClick,
}: PortalHeaderProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleSignOut = () => {
    setOpen(false);
    onSignOut();
  };

  const handleSwitchPortal = () => {
    setOpen(false);
    onSwitchPortal?.();
  };

  const handleProfileClick = () => {
    setOpen(false);
    onProfileClick?.();
  };

  // Desktop header with visible buttons
  if (!isMobile) {
    return (
      <header className="bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold" data-testid={`heading-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {title}
            </h1>
            <div className="flex items-center gap-4">
              {onProfileClick && (
                <Button variant="outline" onClick={onProfileClick} data-testid="button-my-profile">
                  <UserCircle className="h-4 w-4 mr-2" />
                  My Profile
                </Button>
              )}
              {onSwitchPortal && switchPortalLabel && (
                <Button variant="outline" onClick={onSwitchPortal} data-testid="button-switch-portal">
                  {switchPortalLabel.includes('Tech') ? (
                    <Users className="h-4 w-4 mr-2" />
                  ) : (
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                  )}
                  {switchPortalLabel}
                </Button>
              )}
              <Button variant="outline" onClick={onSignOut} data-testid="button-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Mobile header with drawer menu
  return (
    <header className="bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <h1 className="text-xl font-bold" data-testid={`heading-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {title}
          </h1>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-3 mt-6">
                {onProfileClick && (
                  <Button
                    variant="outline"
                    onClick={handleProfileClick}
                    className="w-full justify-start"
                    data-testid="button-my-profile"
                  >
                    <UserCircle className="h-4 w-4 mr-2" />
                    My Profile
                  </Button>
                )}
                {onSwitchPortal && switchPortalLabel && (
                  <Button
                    variant="outline"
                    onClick={handleSwitchPortal}
                    className="w-full justify-start"
                    data-testid="button-switch-portal"
                  >
                    {switchPortalLabel.includes('Tech') ? (
                      <Users className="h-4 w-4 mr-2" />
                    ) : (
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                    )}
                    {switchPortalLabel}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full justify-start"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
