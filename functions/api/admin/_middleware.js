import { isOwner } from "../../../lib/auth.js";
import { error } from "../../../lib/games.js";

// Every /api/admin/* request must come from the signed-in owner.
export async function onRequest(context) {
  if (!(await isOwner(context.request, context.env))) return error("Unauthorized", 401);
  return context.next();
}
