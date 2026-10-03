import { logoutAction } from "@/lib/session-actions";
import { Button } from "@/components/ui/Button";
import { NepaliCalendar } from "@/components/layout/NepaliCalendar";

export function Topbar({
  userName,
  userRole,
}: {
  userName: string;
  userRole: string;
}) {
  return (
    <header className="hidden h-14 items-center lg:flex justify-between glass-container rounded-none border-b border-b-white/30 px-6">
      <NepaliCalendar />
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium text-text">{userName}</div>
          <div className="text-xs text-text-muted">{userRole}</div>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
