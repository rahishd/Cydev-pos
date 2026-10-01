import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export function Topbar({
  userName,
  userRole,
}: {
  userName: string;
  userRole: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between glass-container rounded-none border-b border-b-white/30 px-6">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium text-text">{userName}</div>
          <div className="text-xs text-text-muted">{userRole}</div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
