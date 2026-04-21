import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { session, verifySessionToken } from "@/lib/session";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const token = cookies().get(session.cookieName)?.value;
  if (!verifySessionToken(token)) {
    redirect("/login");
  }
  return (
    <>
      <NavBar />
      <div className="container">{children}</div>
    </>
  );
}
