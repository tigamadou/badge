const FILL = ["bg-rose-600", "bg-rose-600", "bg-amber-700", "bg-green-500", "bg-green-600"];

export function PasswordMeter({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div data-testid="pw-meter" className="my-2.5 flex gap-1.5">
      {[1, 2, 3, 4].map((i) => {
        const on = i <= score;
        return <span key={i} data-on={on} className={`h-1 flex-1 rounded-full ${on ? FILL[score] : "bg-slate-200"}`} />;
      })}
    </div>
  );
}
