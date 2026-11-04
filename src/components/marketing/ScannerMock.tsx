// Maquette du scanner de controle d'acces : cadre sombre, grille, reticule aux
// quatre coins (vert) et ligne laser. Purement decoratif.
export function ScannerMock({ className }: { className?: string }) {
  return (
    <div
      className={`relative mx-auto flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl bg-[#0f172a] ${className ?? "max-w-[280px]"}`}
    >
      <div
        className="absolute inset-0 opacity-35"
        style={{
          background:
            "linear-gradient(#1e293b 1px, transparent 1px) 0 0/100% 28px, linear-gradient(90deg, #1e293b 1px, transparent 1px) 0 0/28px 100%",
        }}
      />
      <div className="relative aspect-square w-[62%]">
        <span className="absolute left-0 top-0 h-[30px] w-[30px] rounded-tl-[12px] border-l-[3px] border-t-[3px] border-turquoise" />
        <span className="absolute right-0 top-0 h-[30px] w-[30px] rounded-tr-[12px] border-r-[3px] border-t-[3px] border-turquoise" />
        <span className="absolute bottom-0 left-0 h-[30px] w-[30px] rounded-bl-[12px] border-b-[3px] border-l-[3px] border-turquoise" />
        <span className="absolute bottom-0 right-0 h-[30px] w-[30px] rounded-br-[12px] border-b-[3px] border-r-[3px] border-turquoise" />
      </div>
      <div className="absolute left-[8%] right-[8%] top-1/2 h-0.5 bg-turquoise shadow-[0_0_12px_var(--color-turquoise)]" />
    </div>
  );
}
