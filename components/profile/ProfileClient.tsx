"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/layout/Avatar";
import { saveMyAvatar } from "@/app/(dashboard)/profile/actions";

/** Centre-crops to a square and shrinks, so the stored photo stays tiny whatever the phone's camera produced. */
async function fileToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(256, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ProfileClient({
  id,
  name,
  userId,
  role,
  avatarVersion,
}: {
  id: string;
  name: string;
  userId: string;
  role: string;
  avatarVersion: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(avatarVersion);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    setMsg(null);
    if (!file.type.startsWith("image/")) {
      setMsg({ ok: false, text: "Please choose a photo (JPG or PNG)." });
      return;
    }
    try {
      setPreview(await fileToAvatar(file));
    } catch {
      setMsg({ ok: false, text: "Could not read that photo. Try another one." });
    }
  };

  const save = async (value: string | null) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await saveMyAvatar(value);
      setVersion(r.version);
      setPreview(null);
      setMsg({ ok: true, text: value ? "Photo saved." : "Photo removed." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save the photo" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-md p-5">
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="New photo" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
        ) : (
          <Avatar id={id} name={name} version={version} className="h-24 w-24 rounded-2xl text-4xl" />
        )}
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-text">{name}</div>
          <div className="text-xs text-text-muted">
            {role} · {userId}
          </div>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {preview ? (
          <>
            <Button onClick={() => save(preview)} disabled={busy}>
              {busy ? "Saving..." : "Save photo"}
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
              {version > 0 ? "Change photo" : "Upload photo"}
            </Button>
            {version > 0 && (
              <Button variant="ghost" onClick={() => save(null)} disabled={busy}>
                Remove
              </Button>
            )}
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-text-muted">Any photo works. It is cropped to a square and made small automatically.</p>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </Card>
  );
}
