import { logoutAction } from "@/lib/session-actions";
import { Button } from "@/components/ui/Button";
import { NepaliCalendar } from "@/components/layout/NepaliCalendar";
import { Weather } from "@/components/layout/Weather";
import Link from "next/link";
import { Avatar } from "@/components/layout/Avatar";
import { ActivityBell } from "@/components/layout/ActivityBell";

export function Topbar({
  userName,
  userRole,
  userKey,
  canOpenLog,
  avatarVersion,
}: {
  userName: string;
  userRole: string;
  userKey: string;
  canOpenLog: boolean;
  avatarVersion: number;
}) {
  return (
    <header className="sticky top-8 z-30 hidden h-16 items-center justify-between border-b border-border bg-surface px-6 lg:flex">
      <div className="flex items-center gap-3">
        <NepaliCalendar />
        <Weather className="whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-text" />
      </div>
      <div className="flex items-center gap-3">
        <ActivityBell userKey={userKey} canOpenLog={canOpenLog} />
        <Link href="/profile" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-zinc-100" title="My profile">
          <div className="text-right leading-tight">
            <div className="text-sm font-medium text-text">{userName}</div>
            <div className="text-xs text-text-muted">{userRole}</div>
          </div>
          <Avatar id={userKey} name={userName} version={avatarVersion} className="h-10 w-10 text-lg" />
        </Link>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
