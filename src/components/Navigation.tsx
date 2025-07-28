import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Calendar, 
  Newspaper, 
  BarChart3, 
  BookOpen, 
  Menu,
  X,
  Activity,
  Settings
} from "lucide-react";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: "Dashboard", icon: TrendingUp, path: "/" },
    { label: "Charts", icon: BarChart3, path: "/charts" },
    { label: "News", icon: Newspaper, path: "/news" },
    { label: "Calendar", icon: Calendar, path: "/calendar" },
    { label: "Learn", icon: BookOpen, path: "/learn" },
    { label: "Admin", icon: Settings, path: "/admin" },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

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
                onClick={() => handleNavigation(item.path)}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            ))}
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
                onClick={() => handleNavigation(item.path)}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};