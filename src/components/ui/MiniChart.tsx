export function MiniChart({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  const max = Math.max(1, ...values);
  return (
    <div role="img" aria-label={ariaLabel} className="flex h-[120px] items-end gap-[3px]">
      {values.map((v, i) => (
        <i
          key={i}
          className="min-h-[3px] flex-1 rounded-t-[3px] bg-navy opacity-85 hover:bg-navy-hover hover:opacity-100"
          style={{ height: `${Math.round((v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
