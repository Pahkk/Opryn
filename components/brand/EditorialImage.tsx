import Image from "next/image";
import type { CSSProperties } from "react";

type EditorialImageProps = {
  src: string;
  alt: string;
  alignment?: "left" | "right" | "center";
  rotation?: number;
  priority?: boolean;
};

/** Original artwork, uncropped. StoryHome's observer reveals below-fold figures once. */
export function EditorialImage({
  src,
  alt,
  alignment = "center",
  rotation = 0,
  priority = false,
}: EditorialImageProps) {
  return (
    <figure
      className={`editorial-image editorial-image--${alignment}${priority ? " editorial-image--hero" : ""}`}
      data-story-reveal={priority ? undefined : ""}
      style={
        {
          "--editorial-rotation": `${Math.max(-2, Math.min(2, rotation))}deg`,
        } as CSSProperties
      }
    >
      <Image
        src={src}
        alt={alt}
        width={1448}
        height={1086}
        sizes="(max-width: 900px) calc(100vw - 32px), 680px"
        preload={priority}
        loading={priority ? undefined : "lazy"}
        quality={75}
      />
    </figure>
  );
}
