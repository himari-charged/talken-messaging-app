import { MessageCircle, UserPlus, Settings, LogOut, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarTab, User } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

const WORKSPACE_NAME = "Talken";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  user: User;
  onNewChat?: () => void;
}

const tabs: { id: SidebarTab; label: string; icon: typeof MessageCircle }[] = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "requests", label: "Requests", icon: UserPlus },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeTab, onTabChange, user, onNewChat }: SidebarProps) {
  const { logout } = useAuth();
  return (
    <aside className="flex w-[72px] shrink-0 flex-col items-center border-r border-border bg-card py-4">
      <div className="mb-6 flex flex-col items-center gap-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold">
          T
        </div>
        <span className="max-w-[52px] truncate text-center text-[10px] font-medium text-muted-foreground">
          {WORKSPACE_NAME}
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {activeTab === "chats" && onNewChat && (
          <Button
            type="button"
            variant="ghost"
            size="default"
            className="flex h-11 w-full flex-col gap-0.5 text-muted-foreground rounded-none"
            onClick={onNewChat}
            title="New chat"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[9px]">New</span>
          </Button>
        )}
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="default"
            onClick={() => onTabChange(id)}
            className={cn(
              "flex h-11 w-full flex-col gap-0.5 rounded-none",
              activeTab === id && "bg-accent text-accent-foreground"
            )}
            title={label}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[9px]">{label}</span>
          </Button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2 border-t border-border pt-4">
        <div className="relative">
          <Avatar className="h-10 w-10 rounded-full" key={user.avatar ?? "no-avatar"}>
            {user.avatar ? (
              <AvatarImage src={user.avatar} alt="" className="rounded-full object-cover" />
            ) : null}
            <AvatarFallback className="rounded-full bg-muted text-sm font-semibold text-foreground">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          {user.isOnline && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </div>
        <Button variant="ghost" size="icon-xs" onClick={logout} title="Log out">
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </aside>
  );
}
