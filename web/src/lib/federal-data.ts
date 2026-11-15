import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertFederalSnapshot,
  type FederalSnapshot,
} from "./federal-contracts";
export async function getFederalContracts(): Promise<FederalSnapshot> {
  const data = JSON.parse(
    await readFile(
      path.join(process.cwd(), "public/data/_federal-contracts.json"),
      "utf8",
    ),
  ) as FederalSnapshot;
  assertFederalSnapshot(data);
  return data;
}
