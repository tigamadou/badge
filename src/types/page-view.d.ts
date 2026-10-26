import type { PageViewElement, PageViewFit, PageViewLayout } from "@tigamadou/pdf-engine/viewer";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "page-view": React.DetailedHTMLProps<React.HTMLAttributes<PageViewElement>, PageViewElement> & {
        page?: number | string;
        layout?: PageViewLayout;
        fit?: PageViewFit;
        "min-zoom"?: number | string;
        "max-zoom"?: number | string;
        label?: string;
      };
    }
  }
}
