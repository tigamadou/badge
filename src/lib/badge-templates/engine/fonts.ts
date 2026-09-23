import { Font } from "@react-pdf/renderer";

// Enregistrement centralise de la police Montserrat utilisee par tous les
// templates v2. Chaque template importe ce module pour declencher Font.register
// (Node cache les modules : Font.register n'est appele qu'une fois par process).
// Les sources fontes proviennent de Google Fonts (CDN public).
Font.register({
  family: "Montserrat",
  fonts: [
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Ew-.ttf", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu170w-.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf", fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq6R9aX8.ttf", fontWeight: 400, fontStyle: "italic" },
    { src: "https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq0N6aX8.ttf", fontWeight: 700, fontStyle: "italic" },
  ],
});

// Marqueur exporte : empeche un bundler de tree-shaker l'import "side-effect".
// Les templates font `import "../fonts"` qui suffit en pratique mais ce const
// rend l'intention explicite.
export const MONTSERRAT_REGISTERED = true;
