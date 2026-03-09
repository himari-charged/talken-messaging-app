import { ChatApp } from "@/components/chat/ChatApp";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import "./App.css";

function AppContent() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <ChatApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
