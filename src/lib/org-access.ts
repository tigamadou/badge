import { cache } from "react";
import { loadOrgAccess } from "@/lib/subscription-access";

// Mis en cache par requête : layout et page d'une même requête partagent la lecture.
export const getOrgAccess = cache(loadOrgAccess);
