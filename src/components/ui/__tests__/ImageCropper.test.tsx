import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ID_PHOTO_REQUIREMENT } from "@/lib/badge-templates/image-frames";
import { ImageCropper, isConforming, outputMimeFor } from "../ImageCropper";

describe("ImageCropper", () => {
  it("outputMimeFor : PNG pour PNG et WebP, JPEG pour JPEG", () => {
    expect(outputMimeFor(new Blob([], { type: "image/webp" }))).toBe("image/png");
    expect(outputMimeFor(new Blob([], { type: "image/png" }))).toBe("image/png");
    expect(outputMimeFor(new Blob([], { type: "image/jpeg" }))).toBe("image/jpeg");
  });

  it("isConforming suit les exigences", () => {
    expect(isConforming({ width: 420, height: 540 }, ID_PHOTO_REQUIREMENT)).toBe(true);
    expect(isConforming({ width: 540, height: 540 }, ID_PHOTO_REQUIREMENT)).toBe(false);
  });

  it("ne rend rien fermé", () => {
    const html = renderToStaticMarkup(
      <ImageCropper
        open={false}
        title="Recadrer"
        source={null}
        requirement={ID_PHOTO_REQUIREMENT}
        outputMime="image/png"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toBe("");
  });
});
