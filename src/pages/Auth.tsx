import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const authSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
});

type AuthFormValues = z.infer<typeof authSchema>;

const Auth = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    document.title = tab === "login" ? "Login | ForexPro" : "Sign Up | ForexPro";
  }, [tab]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        toast.success("Signed in successfully");
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

  const onLogin = async (values: AuthFormValues) => {
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

  const onSignup = async (values: AuthFormValues) => {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>{tab === "login" ? "Login" : "Create your account"}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSubmit(onLogin)} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
                    {errors.email && <p className="text-sm text-bearish mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
                    {errors.password && <p className="text-sm text-bearish mt-1">{errors.password.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSubmit(onSignup)} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" type="email" placeholder="you@example.com" {...register("email")} />
                    {errors.email && <p className="text-sm text-bearish mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="password2">Password</Label>
                    <Input id="password2" type="password" placeholder="••••••••" {...register("password")} />
                    {errors.password && <p className="text-sm text-bearish mt-1">{errors.password.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
