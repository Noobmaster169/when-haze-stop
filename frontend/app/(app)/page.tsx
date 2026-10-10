import { redirect } from "next/navigation";

/** The map is the product, so it is also the front door. */
export default function HomePage() {
  redirect("/map");
}
