import { getSettings } from "@/lib/settings";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";

export const maxDuration = 60;

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      userId: formData.get("userId"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const locked = (error as { code?: string }).code === "locked";
      redirect(locked ? "/login?error=locked" : "/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const settings = await getSettings();
  const shopName = String(settings.business.shopName);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={settings.business.logo ?? "/logo.png"} alt={shopName} className="mb-4 h-[72px] w-[72px] rounded-lg object-contain" />
        <h1 className="mb-1 text-lg font-semibold text-text">Sign in</h1>
        <p className="mb-6 text-sm text-text-muted">
          {shopName} Inventory
        </p>

        <form action={login} className="space-y-4">
          <div>
            <Label htmlFor="userId">User ID</Label>
            <Input id="userId" name="userId" type="text" placeholder="e.g. U001" autoComplete="username" autoCapitalize="characters" required autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>

          {error && (
            <p className="text-sm text-danger">
              {error === "locked"
                ? "Too many wrong attempts. This account is locked for a while. Please try again later or ask the Owner."
                : "Invalid User ID or password."}
            </p>
          )}

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
