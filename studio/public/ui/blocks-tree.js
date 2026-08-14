// Operations d'arbre sur les blocs d'un manifeste. Module PUR, sans aucun import :
// il tourne tel quel dans le navigateur (module ES) comme sous Vitest.
//
// Un chemin est un tableau d'indices : [2, 0] designe l'enfant 0 du bloc racine 2.
// Toutes les fonctions sont immuables — seule la branche touchee est reconstruite.

export function getAt(blocks, path) {
  let siblings = blocks;
  let found;
  for (const index of path) {
    found = siblings?.[index];
    if (found === undefined) return undefined;
    siblings = found.blocks;
  }
  return found;
}

// Remplace, supprime ou insere au chemin donne selon `mutate`, qui recoit la liste
// des freres et l'indice vise et rend la nouvelle liste.
function editSiblings(blocks, path, mutate) {
  const [index, ...rest] = path;
  if (rest.length === 0) return mutate(blocks, index);
  const parent = blocks[index];
  const next = blocks.slice();
  next[index] = { ...parent, blocks: editSiblings(parent.blocks ?? [], rest, mutate) };
  return next;
}

export function setAt(blocks, path, next) {
  return editSiblings(blocks, path, (siblings, index) => {
    const copy = siblings.slice();
    copy[index] = next;
    return copy;
  });
}

export function removeAt(blocks, path) {
  return editSiblings(blocks, path, (siblings, index) =>
    siblings.filter((_, position) => position !== index),
  );
}

export function insertAfter(blocks, path, block) {
  return editSiblings(blocks, path, (siblings, index) => {
    const copy = siblings.slice();
    copy.splice(index + 1, 0, block);
    return copy;
  });
}

export function moveWithin(blocks, path, delta) {
  return editSiblings(blocks, path, (siblings, position) => {
    const target = position + delta;
    if (target < 0 || target >= siblings.length) return siblings;
    const copy = siblings.slice();
    [copy[position], copy[target]] = [copy[target], copy[position]];
    return copy;
  });
}

export function flatten(blocks, prefix = []) {
  const out = [];
  blocks.forEach((block, index) => {
    const path = [...prefix, index];
    out.push({ path, block });
    if (block.type === "group") out.push(...flatten(block.blocks ?? [], path));
  });
  return out;
}

// Enveloppe des freres dans un groupe : le cadre englobe exactement les blocs
// choisis, dont les coordonnees deviennent relatives — le rendu ne bouge pas d'un
// pixel. A la racine, tous doivent partager la meme page, portee ensuite par le groupe.
export function groupSiblings(blocks, parentPath, indices) {
  if (indices.length < 2) {
    return { ok: false, reason: "Sélectionnez au moins deux blocs à grouper." };
  }
  const siblings = parentPath.length === 0 ? blocks : (getAt(blocks, parentPath)?.blocks ?? []);
  const chosen = indices.map((index) => siblings[index]);
  if (chosen.some((block) => block === undefined)) {
    return { ok: false, reason: "Sélection invalide." };
  }

  const isRoot = parentPath.length === 0;
  const pages = new Set(chosen.map((block) => block.page));
  if (isRoot && pages.size > 1) {
    return { ok: false, reason: "Les blocs à grouper doivent être sur la même page." };
  }

  const minX = Math.min(...chosen.map((block) => block.x));
  const minY = Math.min(...chosen.map((block) => block.y));
  const maxX = Math.max(...chosen.map((block) => block.x + block.w));
  const maxY = Math.max(...chosen.map((block) => block.y + block.h));

  const group = {
    type: "group",
    ...(isRoot ? { page: chosen[0].page } : {}),
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    blocks: chosen.map((block) => {
      const child = { ...block, x: block.x - minX, y: block.y - minY };
      delete child.page;
      return child;
    }),
  };

  const first = Math.min(...indices);
  const remaining = siblings.filter((_, index) => !indices.includes(index));
  const kept = remaining.slice(0, first);
  const after = remaining.slice(first);
  const nextSiblings = [...kept, group, ...after];

  if (isRoot) return { ok: true, blocks: nextSiblings };
  const parent = getAt(blocks, parentPath);
  return { ok: true, blocks: setAt(blocks, parentPath, { ...parent, blocks: nextSiblings }) };
}

// Dissout un groupe : ses enfants repassent en absolu et remontent d'un niveau. Un
// groupe porteur d'un effet de conteneur ne peut pas se dissoudre sans changer le
// rendu — on le refuse plutot que d'alterer le PDF en silence.
export function ungroupAt(blocks, path) {
  const group = getAt(blocks, path);
  if (!group || group.type !== "group") {
    return { ok: false, reason: "Ce bloc n'est pas un groupe." };
  }
  if (group.rotate !== undefined || group.opacity !== undefined || group.visibleIf !== undefined) {
    return {
      ok: false,
      reason: "Retirez d'abord la rotation, l'opacité ou la condition du groupe.",
    };
  }

  const isRoot = path.length === 1;
  const children = (group.blocks ?? []).map((child) => {
    const promoted = { ...child, x: child.x + group.x, y: child.y + group.y };
    if (isRoot) promoted.page = group.page;
    return promoted;
  });

  return {
    ok: true,
    blocks: editSiblings(blocks, path, (siblings, index) => {
      const copy = siblings.slice();
      copy.splice(index, 1, ...children);
      return copy;
    }),
  };
}
