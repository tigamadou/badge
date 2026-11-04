import { Fragment } from "react";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mb-7 flex items-center">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "on" : "todo";
        return (
          <Fragment key={label}>
            <div data-state={state} className="flex items-center gap-2.5">
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${
                  state === "on"
                    ? "bg-navy text-white"
                    : state === "done"
                      ? "bg-turquoise-soft text-turquoise-strong"
                      : "bg-mist text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-sm font-medium max-[720px]:hidden ${
                  state === "todo" ? "text-slate-400" : state === "done" ? "text-slate-600" : "text-slate-900"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span className="mx-3.5 h-0.5 w-12 bg-slate-200 max-[720px]:mx-2 max-[720px]:w-6" />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
