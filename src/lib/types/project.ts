import type { Database } from "@/types/database";

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectVersion =
  Database["public"]["Tables"]["project_versions"]["Row"];

