import Image from "next/image";
import bayyenLogo from "@/public/bayyen-logo.png";

export function LogoMark() {
  return (
    <span className="brand-lockup">
      <Image
        className="brand-logo-image"
        src={bayyenLogo}
        alt="شعار بيِّن"
        sizes="(max-width: 700px) 72px, 104px"
        loading="eager"
      />
    </span>
  );
}
