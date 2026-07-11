import type { MediaItem } from "@/lib/media-types";
import { ListControls } from "./ListControls";

export function UserListPanel({ item }: { item: MediaItem }) {
  return <ListControls item={item} />;
}
