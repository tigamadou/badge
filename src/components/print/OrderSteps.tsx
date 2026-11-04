import type { PrintRequestStatus, PrintRequestType } from "@prisma/client";
import { orderSteps, type StepState } from "./order-steps";

const DOT: Record<StepState, string> = {
  done: "bg-navy text-white",
  current: "bg-navy text-white ring-4 ring-mist",
  todo: "bg-slate-200 text-slate-500",
  stopped: "bg-rose-600 text-white ring-4 ring-rose-100",
};

// Frise d'avancement : horizontale à partir de `sm`, verticale en dessous.
export function OrderSteps({
  status,
  type,
  stoppedAt,
}: {
  status: PrintRequestStatus;
  type: PrintRequestType;
  stoppedAt?: PrintRequestStatus;
}) {
  const steps = orderSteps(status, type, stoppedAt);
  return (
    <ol aria-label="Avancement de la commande" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-2">
      {steps.map((step, i) => (
        <li
          key={step.key}
          aria-current={step.state === "current" || step.state === "stopped" ? "step" : undefined}
          data-state={step.state}
          className="flex items-center gap-2 text-sm"
        >
          <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${DOT[step.state]}`}>
            {step.state === "stopped" ? "×" : i + 1}
          </span>
          <span className={step.state === "todo" ? "text-slate-400" : "font-medium text-slate-800"}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
