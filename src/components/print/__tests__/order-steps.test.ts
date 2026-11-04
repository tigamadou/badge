import { describe, expect, it } from "vitest";
import { orderSteps } from "../order-steps";

const states = (s: ReturnType<typeof orderSteps>) => s.map((x) => x.state);

describe("orderSteps", () => {
  it("PAID : 3 étapes faites, PAID courante, 3 à venir", () => {
    const steps = orderSteps("PAID", "ADVANCE");
    expect(states(steps)).toEqual(["done", "done", "done", "current", "todo", "todo", "todo"]);
    expect(steps.map((s) => s.label)).toEqual(["Envoyée", "Devis", "Accepté", "Payée", "Production", "Prête", "Terminée"]);
  });

  it("DRAFT : tout à venir", () => {
    expect(new Set(states(orderSteps("DRAFT", "ONSITE")))).toEqual(new Set(["todo"]));
  });

  it("REJECTED : étape d'arrêt marquée stoppée, rien après", () => {
    expect(states(orderSteps("REJECTED", "ADVANCE"))).toEqual(["stopped"]);
    const steps = orderSteps("CANCELLED", "ADVANCE", "ACCEPTED");
    expect(states(steps)).toEqual(["done", "done", "stopped"]);
    expect(steps[2].key).toBe("ACCEPTED");
  });

  it("COMPLETED : dernière étape courante", () => {
    expect(states(orderSteps("COMPLETED", "ADVANCE")).at(-1)).toBe("current");
  });
});
