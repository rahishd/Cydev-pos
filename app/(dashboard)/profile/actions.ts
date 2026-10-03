"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";

const MAX_AVATAR_CHARS = 160_000;

/** Anyone signed in may change their own photo; nobody can change someone else's through this. */
export async function saveMyAvatar(dataUrl: string | null) {
  const access = await getAccess();
  if (!access) throw new Error("Please sign in again.");

  if (dataUrl !== null) {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      throw new Error("The photo must be a PNG or JPG image.");
    }
    if (dataUrl.length > MAX_AVATAR_CHARS) throw new Error("That photo is too large. Try a smaller one.");
  }

  const updated = await prisma.user.update({
    where: { id: access.id },
    data: { avatar: dataUrl, avatarVersion: dataUrl ? access.avatarVersion + 1 : 0 },
    select: { avatarVersion: true },
  });

  await logAudit({
    actor: access,
    action: "updated",
    title: dataUrl ? "Profile Photo Changed" : "Profile Photo Removed",
    module: "Users",
    entityType: "User",
    entityId: access.id,
    description: dataUrl ? "Updated their profile photo" : "Removed their profile photo",
  });

  revalidatePath("/", "layout");
  return { version: updated.avatarVersion };
}
