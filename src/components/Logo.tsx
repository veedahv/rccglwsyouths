// The RCCG crest and the Young Adults & Youths crest, side by side.
// `chip` sits them on a white rounded tile so they stay legible on the
// purple sidebar and login panel (the crests have transparent edges).

import youthLogo from "@/assets/logo.png";
import rccgLogo from "@/assets/Rccg_logo.png";

export default function Logo({ size = 32, chip = false }: { size?: number; chip?: boolean }) {
  const crests = (
    <>
      <img src={rccgLogo.src} height={size} style={{ height: size, width: "auto" }} alt="" />
      <img src={youthLogo.src} height={size} style={{ height: size, width: "auto" }} alt="" />
    </>
  );

  if (!chip) return <div className="flex items-center gap-1.5">{crests}</div>;

  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-white px-2 py-1.5 shadow-sm">{crests}</div>
  );
}
