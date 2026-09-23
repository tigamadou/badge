import zlib from "node:zlib";

// Decompresse chaque flux FlateDecode d'un PDF @react-pdf. Les flux non compresses
// (ou d'un autre filtre) sont ignores : ils ne portent ni texte ni table ToUnicode.
function inflatedStreams(pdf: Buffer): string[] {
  const raw = pdf.toString("latin1");
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  const streams: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(raw))) {
    try {
      streams.push(zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"));
    } catch {
      // Pas du FlateDecode, ou flux corrompu pour cette lecture : sans interet ici.
    }
  }
  return streams;
}

// Table code-glyphe -> caractere Unicode, lue dans les blocs ToUnicode
// (beginbfchar/beginbfrange) d'un flux decompresse.
function readCidMap(streams: string[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const stream of streams) {
    for (const block of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
        map.set(pair[1].toLowerCase(), String.fromCodePoint(parseInt(pair[2], 16)));
      }
    }

    for (const block of stream.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      // Forme tableau : <lo> <hi> [<d0> <d1> ...], une destination par code du
      // segment. Traitee EN PREMIER et retiree du texte restant : sinon la forme
      // increment ci-dessous matche a tort des triplets pris DANS le tableau (les
      // deux ecritures se chevauchent syntaxiquement sur les memes hex).
      const arrayForm = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]+)\]/g;
      let remainder = block[1];
      for (const entry of block[1].matchAll(arrayForm)) {
        const destinations = [...entry[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((d) => d[1]);
        const low = parseInt(entry[1], 16);
        destinations.forEach((destination, offset) => {
          const code = (low + offset).toString(16).padStart(entry[1].length, "0");
          map.set(code.toLowerCase(), String.fromCodePoint(parseInt(destination, 16)));
        });
        remainder = remainder.replace(entry[0], "");
      }

      // Forme increment : <lo> <hi> <dst>, une seule destination de depart pour
      // tout le segment, incrementee code par code.
      for (const entry of remainder.matchAll(
        /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g,
      )) {
        const low = parseInt(entry[1], 16);
        const high = parseInt(entry[2], 16);
        const destination = parseInt(entry[3], 16);
        for (let code = low; code <= high; code++) {
          map.set(
            code.toString(16).padStart(entry[1].length, "0"),
            String.fromCodePoint(destination + (code - low)),
          );
        }
      }
    }
  }

  return map;
}

// Decode le texte REELLEMENT dessine dans un PDF @react-pdf, preuve directe qu'une
// valeur a atteint le rendu. La police embarquee est en CID : les operateurs Tj/TJ
// ne portent pas les caracteres mais des codes glyphe (`[<00010002...> 0] TJ`),
// retraduits ici via la table ToUnicode que @react-pdf embarque pour
// l'accessibilite/la recherche. Sans cette retraduction, un rendu a valeurs vides
// et un rendu correctement alimente produisent le meme en-tete, le meme nombre de
// pages et le meme MediaBox : seul le contenu du flux de page les distingue.
export function extractPdfText(pdf: Buffer): string {
  const streams = inflatedStreams(pdf);
  const cidMap = readCidMap(streams);
  let text = "";

  for (const stream of streams) {
    for (const block of stream.matchAll(/BT([\s\S]*?)ET/g)) {
      for (const hex of block[1].matchAll(/<([0-9a-fA-F]+)>/g)) {
        const codes = hex[1];
        for (let i = 0; i + 4 <= codes.length; i += 4) {
          text += cidMap.get(codes.slice(i, i + 4).toLowerCase()) ?? "";
        }
      }
    }
  }

  return text;
}
