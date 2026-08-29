import { redirect } from "next/navigation";

// Sign-in is closed — the trial has ended. Anyone reaching /login is sent to the
// farewell page. (The original magic-link + Google sign-in UI is in git history
// if the app is ever reopened.)
export default function LoginPage() {
  redirect("/");
}
