import { redirect } from "next/navigation";
import { todayVN } from "../../lib/date";

export default function DealHotIndex(): never {
  redirect(`/deal-hot/${todayVN()}`);
}
