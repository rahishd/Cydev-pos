import { requirePermission } from "@/lib/access";
import { ProfileClient } from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const access = await requirePermission();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">My Profile</h1>
        <p className="text-sm text-text-muted">Your photo shows in the header and on your home screen.</p>
      </div>
      <ProfileClient
        id={access.id}
        name={access.name}
        userId={access.userId}
        role={access.isOwner ? "Owner" : "Staff"}
        avatarVersion={access.avatarVersion}
      />
    </div>
  );
}
