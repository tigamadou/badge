// Vue publique d'un export : jamais registrationIds (volumineux), lockedBy ni `error` (message
// interne du worker : S3, rendu, Prisma) ; l'organisateur n'a que le statut. Le détail est sur
// l'écran plateforme du personnel.
export function exportView(g: {
  id: string;
  status: string;
  badgeCount: number | null;
  fileKey: string | null;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: g.id,
    status: g.status,
    badgeCount: g.badgeCount,
    fileKey: g.fileKey,
    createdAt: g.createdAt,
    completedAt: g.completedAt,
  };
}
