import { login } from "../../lib/auth.js";

export const onRequestPost = ({ request, env }) => login(request, env);
