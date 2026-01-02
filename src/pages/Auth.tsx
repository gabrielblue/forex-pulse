import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { PasswordValidator } from "@/lib/security/validator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { TrendingUp, Shield, Zap, BarChart3, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(1, "Password is required").max(100),
});

const signupSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(100, "Password must be less than 100 characters")
    .refine(
      (val) => PasswordValidator.validate(val).valid,
      (val) => {
        const errors = PasswordValidator.validate(val).errors;
        return { message: errors.join(". ") };
      }
    ),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

const Auth = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    document.title = tab === "login" ? "Login | ForexPulse AI" : "Sign Up | ForexPulse AI";
  }, [tab]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        toast.success("Welcome to ForexPulse AI!");
        navigate("/", { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const onLogin = async (values: LoginFormValues) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;
    } catch (e: any) {
      const msg = e?.message || "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onSignup = async (values: SignupFormValues) => {
    try {
      setLoading(true);
      setError(null);
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { emailRedirectTo: redirectUrl },
      });
      if (error) throw error;
      toast.success("Check your email to confirm your account");
      setTab("login");
    } catch (e: any) {
      const msg = e?.message || "Signup failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: TrendingUp, title: "AI-Powered Trading", desc: "Smart Money Concepts analysis" },
    { icon: BarChart3, title: "Gold & Forex", desc: "Trade XAUUSD, EURUSD, GBPUSD" },
    { icon: Shield, title: "Risk Management", desc: "Capital preservation priority" },
    { icon: Zap, title: "Real-Time Signals", desc: "65%+ confluence signals only" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex">
      {/* Left Panel - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-12 flex-col justify-center">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-primary/20">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">ForexPulse AI</h1>
              <p className="text-muted-foreground">Institutional-Grade Trading</p>
            </div>
          </div>
          
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Trade Like The Institutions
          </h2>
          <p className="text-muted-foreground mb-8">
            AI-powered trading bot using Smart Money Concepts (SMC) - Order Blocks, Fair Value Gaps, 
            Liquidity Zones, and Break of Structure analysis.
          </p>
          
          <div className="grid gap-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-lg bg-card/50 border border-border/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 p-4 rounded-lg bg-bullish/10 border border-bullish/20">
            <p className="text-sm text-bullish font-medium">
              ✓ ChartLord AI-style confluence trading
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Only executes trades with 5+ SMC factors aligned
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="p-3 rounded-xl bg-primary/20">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">ForexPulse AI</h1>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl">
                {tab === "login" ? "Welcome back" : "Create your account"}
              </CardTitle>
              <CardDescription>
                {tab === "login" 
                  ? "Sign in to access your trading dashboard" 
                  : "Start trading with AI-powered analysis"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setError(null); }} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-0">
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input 
                        id="login-email" 
                        type="email" 
                        placeholder="trader@example.com" 
                        autoComplete="email"
                        {...loginForm.register("email")} 
                      />
                      {loginForm.formState.errors.email && (
                        <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Input 
                          id="login-password" 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Enter your password" 
                          autoComplete="current-password"
                          {...loginForm.register("password")} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Signing in...
                        </span>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input 
                        id="signup-email" 
                        type="email" 
                        placeholder="trader@example.com" 
                        autoComplete="email"
                        {...signupForm.register("email")} 
                      />
                      {signupForm.formState.errors.email && (
                        <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Input 
                          id="signup-password" 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Create a strong password"
                          autoComplete="new-password"
                          {...signupForm.register("password")} 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      {signupForm.formState.errors.password && (
                        <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Min 12 chars with uppercase, lowercase, numbers & symbols
                      </p>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Creating account...
                        </span>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      By signing up, you agree to our terms of service
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Powered by Smart Money Concepts & AI Analysis
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
