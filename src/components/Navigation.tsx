import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  TrendingUp, 
  Calendar, 
  Newspaper, 
  BarChart3, 
  BookOpen, 
  Menu,
  X,
  Activity,
  Settings,
  LogOut,
  User
} from "lucide-react";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  const navItems = [
    { label: "Dashboard", icon: TrendingUp, path: "/" },
    { label: "Charts", icon: BarChart3, path: "/charts" },
    { label: "News", icon: Newspaper, path: "/news" },
    { label: "Calendar", icon: Calendar, path: "/calendar" },
    { label: "Learn", icon: BookOpen, path: "/learn" },
    { label: "Admin", icon: Settings, path: "/admin" },
  ];

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary-glow">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">ForexPro</h1>
              <p className="text-xs text-muted-foreground">Analytics & Predictions</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Button
                key={item.label}
                variant={location.pathname === item.path ? "default" : "ghost"}
                size="sm"
                className={`flex items-center space-x-2 ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            ))}
            
            {/* User info and Logout */}
            {userEmail && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="hidden lg:inline max-w-[150px] truncate">{userEmail}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="ml-2">Logout</span>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-muted-foreground"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 space-y-1 animate-fade-in">
            {navItems.map((item) => (
              <Button
                key={item.label}
                variant={location.pathname === item.path ? "default" : "ghost"}
                size="sm"
                className={`w-full justify-start space-x-2 ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  navigate(item.path);
                  setIsMenuOpen(false);
                }}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            ))}
            
            {/* Mobile User info and Logout */}
            {userEmail && (
              <div className="pt-2 mt-2 border-t border-border space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="truncate">{userEmail}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="ml-2">Logout</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};
