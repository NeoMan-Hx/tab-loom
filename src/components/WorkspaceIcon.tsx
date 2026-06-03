import {
  Archive,
  BookOpen,
  Briefcase,
  Code,
  Folder,
  Globe,
  Palette,
  Pin,
  Rocket,
  Search,
  Settings,
  Star,
  type LucideIcon
} from "lucide-react";
import type { WorkspaceIconKey } from "../types";

const ICONS: Record<WorkspaceIconKey, LucideIcon> = {
  briefcase: Briefcase,
  code: Code,
  palette: Palette,
  "book-open": BookOpen,
  rocket: Rocket,
  star: Star,
  globe: Globe,
  folder: Folder,
  search: Search,
  archive: Archive,
  settings: Settings,
  pin: Pin
};

export function WorkspaceIcon({ iconKey, size = 16 }: { iconKey: WorkspaceIconKey; size?: number }) {
  const Icon = ICONS[iconKey] ?? Briefcase;
  return <Icon size={size} />;
}
