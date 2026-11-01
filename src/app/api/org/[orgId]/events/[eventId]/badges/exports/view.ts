// Vue publique d'un export : jamais registrationIds (volumineux) ni lockedBy.
export function exportView(g: {
  id: string;
  status: string;
  badgeCount: number | null;
  fileKey: string | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: g.id,
    status: g.status,
    badgeCount: g.badgeCount,
    fileKey: g.fileKey,
    error: g.error,
    createdAt: g.createdAt,
    completedAt: g.completedAt,
  };
}
