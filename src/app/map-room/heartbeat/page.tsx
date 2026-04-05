import { redirect } from "next/navigation";

export default function HeartbeatRedirect() {
  redirect("/machine-room/heartbeat");
}
