import { useRef, useState } from "react";
import { Camera, Copy, LogOut, Check, User, Wallet, CircleUser } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPT_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

type SettingsTab = "profile" | "wallet" | "account";

const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "account", label: "Account", icon: CircleUser },
];

export function SettingsPanel() {
  const { session, profile, updateProfile, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [copied, setCopied] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const displayName = profile.displayName.trim();
  const avatarUrl = profile.profileImageUrl;
  const shortAddress = session?.shortAddress ?? "";
  const address = session?.address ?? "";

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setProfileError("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateProfile({ profileImageUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    updateProfile({ profileImageUrl: null });
    setProfileError(null);
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden border-r border-border bg-card">
      {/* Left sidebar */}
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-border bg-muted/30">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground">Manage your account</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              className={cn(
                "justify-start gap-3 text-foreground",
                activeTab === id && "bg-accent text-accent-foreground"
              )}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-sm">{label}</span>
            </Button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-auto">
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-md">
            {activeTab === "profile" && (
              <>
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-foreground">Profile</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Your display name and profile picture (shown in sidebar and chat)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={handleAvatarClick}
                        className="relative shrink-0 rounded-full ring-2 ring-border ring-offset-2 ring-offset-background transition hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <Avatar className="h-20 w-20 rounded-full">
                          {avatarUrl ? (
                            <AvatarImage src={avatarUrl} alt="Profile" className="rounded-full object-cover" />
                          ) : null}
                          <AvatarFallback className="rounded-full bg-muted text-2xl font-semibold text-foreground">
                            {displayName ? displayName.charAt(0) : shortAddress?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                          <Camera className="h-3.5 w-3.5" />
                        </span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPT_IMAGE_TYPES}
                        onChange={handleFileChange}
                        className="hidden"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor="settings-display-name" className="text-foreground">Display name</Label>
                        <Input
                          id="settings-display-name"
                          placeholder={shortAddress}
                          value={profile.displayName}
                          onChange={(e) => updateProfile({ displayName: e.target.value })}
                          className="bg-background text-foreground border-input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Shown to others in chats. Leave blank to use short address.
                        </p>
                        {avatarUrl && (
                          <Button type="button" variant="ghost" size="sm" onClick={handleRemoveAvatar}>
                            Remove photo
                          </Button>
                        )}
                      </div>
                    </div>
                    {profileError && (
                      <p className="text-sm text-destructive">{profileError}</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "wallet" && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">Wallet</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Your Quai wallet address and network
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Address</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={address}
                        className="font-mono text-sm text-foreground bg-muted/50 border-input"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCopyAddress}
                        title="Copy address"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Network</p>
                    <p className="text-sm font-medium text-foreground">Quai Network (Mainnet)</p>
                    <p className="text-xs text-muted-foreground mt-1">RPC: rpc.quai.network</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this address to receive QUAI and to identify you in Talken. Never share your private key.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === "account" && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">Account</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Sign out from this device
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={address}
                      className="font-mono text-sm text-foreground bg-muted/50 border-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCopyAddress}
                      title="Copy address"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" className="w-full text-foreground" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
