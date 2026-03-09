import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { hasPelagus, createBrowserProvider } from "@/lib/quai";

export function LoginScreen() {
  const { loginWithPrivateKey, loginWithSignedMessage } = useAuth();
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePelagus = async () => {
    setError(null);
    if (!hasPelagus()) {
      setError("Pelagus wallet not detected. Install the extension.");
      return;
    }
    setLoading(true);
    try {
      const provider = createBrowserProvider();
      if (!provider) {
        setError("Could not connect to Pelagus");
        return;
      }
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const message = `Sign in to Talken\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);
      const result = await loginWithSignedMessage(address, message, signature);
      if (result.ok) return;
      setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!privateKey.trim()) {
      setError("Enter your private key");
      return;
    }
    setLoading(true);
    try {
      const result = await loginWithPrivateKey(privateKey);
      if (result.ok) {
        setPrivateKey("");
        return;
      }
      setError(result.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground">
            T
          </div>
          <CardTitle className="text-xl">Talken</CardTitle>
          <CardDescription>Sign in with your Quai wallet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPelagus() && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handlePelagus}
                disabled={loading}
              >
                Connect with Pelagus
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pk">Private key</Label>
              <Input
                id="pk"
                type="password"
                autoComplete="off"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="0x..."
                className={cn(error && "border-destructive focus-visible:ring-destructive")}
              />
              <p className="text-xs text-muted-foreground">
                Your key is used locally to sign in and is never stored or sent to a server.
              </p>
            </div>
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Connecting..." : "Connect wallet"}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            By connecting, you agree to use Talken with your Quai Network wallet per{" "}
            <a
              href="https://docs.qu.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Quai docs
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
