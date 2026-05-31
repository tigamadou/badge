export function StaffBanner({ orgName }: { orgName: string }) {
  return (
    <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900">
      <strong>Mode staff</strong> — vous consultez l&apos;organisation <em>{orgName}</em> en tant
      que membre du staff applicatif. Toutes vos actions sont auditées et visibles par le OWNER.
    </div>
  );
}
