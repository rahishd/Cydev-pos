import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Profile photos are stored as small data URLs; this serves them as real images so pages stay light. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { avatar: true } });
  const match = user?.avatar?.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (!match) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      // The page adds ?v=<version>, so a changed photo gets a new URL and old copies can be kept.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
