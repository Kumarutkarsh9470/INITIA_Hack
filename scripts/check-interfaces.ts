/**
 * Contract Interface Checker
 * 
 * Run after replacing contracts:
 *   npx hardhat compile
 *   npx ts-node scripts/check-interfaces.ts
 * 
 * Compares compiled artifacts against CONTRACT_SNAPSHOT.json
 * and reports all breaking changes that need fixing in:
 *   - scripts/deploy.ts
 *   - scripts/wire.ts
 *   - test/shared/fixtures.ts
 *   - deployed-addresses.json
 */

import * as fs from "fs";
import * as path from "path";

interface AbiItem {
  type: string;
  name?: string;
  inputs?: { name: string; type: string; indexed?: boolean }[];
  outputs?: { name: string; type: string }[];
  stateMutability?: string;
}

interface SnapshotFunction {
  sig: string;
  visibility: string;
  modifiers: string[];
  returns: string | null;
  used_by: string[];
}

interface SnapshotContract {
  file: string;
  constructor: {
    params: { name: string; type: string }[];
    deploy_arg_source: string;
  };
  constants: Record<string, string>;
  functions: Record<string, SnapshotFunction>;
  events: Record<string, string>;
  state_variables: Record<string, string>;
  roles: Record<string, string>;
  calls_to: string[];
}

interface Snapshot {
  contracts: Record<string, SnapshotContract>;
  deployment_order: any[];
  wiring_steps: any[];
}

// ── helpers ──────────────────────────────────────────────────

function loadArtifact(contractName: string): { abi: AbiItem[] } | null {
  const artifactDir = path.join(__dirname, "..", "artifacts", "contracts");
  // Search recursively for the artifact
  const dirs = [
    path.join(artifactDir, `${contractName}.sol`, `${contractName}.json`),
    path.join(artifactDir, "erc6551", `${contractName}.sol`, `${contractName}.json`),
    path.join(artifactDir, "initia", `${contractName}.sol`, `${contractName}.json`),
  ];
  for (const p of dirs) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
  }
  return null;
}

function abiSig(item: AbiItem): string {
  const inputs = (item.inputs || []).map((i) => i.type).join(",");
  return `${item.name}(${inputs})`;
}

function abiEventSig(item: AbiItem): string {
  const inputs = (item.inputs || [])
    .map((i) => `${i.type}${i.indexed ? " indexed" : ""} ${i.name}`)
    .join(", ");
  return `${item.name}(${inputs})`;
}

function findConstructor(abi: AbiItem[]): AbiItem | undefined {
  return abi.find((i) => i.type === "constructor");
}

// ── main comparison ──────────────────────────────────────────

function main() {
  const snapshotPath = path.join(__dirname, "..", "CONTRACT_SNAPSHOT.json");
  if (!fs.existsSync(snapshotPath)) {
    console.error("❌ CONTRACT_SNAPSHOT.json not found at project root.");
    process.exit(1);
  }

  const snapshot: Snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  const results: {
    contract: string;
    type: "error" | "warning";
    message: string;
  }[] = [];

  for (const [name, snap] of Object.entries(snapshot.contracts)) {
    const artifact = loadArtifact(name);

    if (!artifact) {
      results.push({
        contract: name,
        type: "error",
        message: `Artifact not found. Run 'npx hardhat compile' first, or the contract was renamed/removed.`,
      });
      continue;
    }

    const abi = artifact.abi;

    // 1. Check constructor params
    const ctor = findConstructor(abi);
    const expectedParams = snap.constructor.params;
    const actualParams = ctor?.inputs || [];
    if (expectedParams.length !== actualParams.length) {
      results.push({
        contract: name,
        type: "error",
        message: `Constructor changed: expected ${expectedParams.length} params (${expectedParams.map((p) => p.name).join(", ")}), got ${actualParams.length} params (${actualParams.map((p) => p.name).join(", ")}). UPDATE deploy.ts step for ${name}.`,
      });
    } else {
      for (let i = 0; i < expectedParams.length; i++) {
        if (expectedParams[i].type !== actualParams[i].type) {
          results.push({
            contract: name,
            type: "error",
            message: `Constructor param '${expectedParams[i].name}' type changed: expected ${expectedParams[i].type}, got ${actualParams[i].type}. UPDATE deploy.ts.`,
          });
        }
        if (expectedParams[i].name !== actualParams[i].name) {
          results.push({
            contract: name,
            type: "warning",
            message: `Constructor param renamed: '${expectedParams[i].name}' → '${actualParams[i].name}'. Likely harmless but verify deploy.ts.`,
          });
        }
      }
    }

    // 2. Check functions still exist
    const abiFunctions = abi.filter(
      (i) => i.type === "function"
    );
    const abiFuncNames = new Set(abiFunctions.map((f) => f.name));

    for (const [fnName, fnSnap] of Object.entries(snap.functions)) {
      if (!abiFuncNames.has(fnName)) {
        results.push({
          contract: name,
          type: "error",
          message: `Function '${fnName}' removed! Was: ${fnSnap.sig}. Used by: ${fnSnap.used_by.join(", ")}. MUST UPDATE callers.`,
        });
      } else {
        // Check signature matches
        const abiFn = abiFunctions.find((f) => f.name === fnName)!;
        const actualSig = abiSig(abiFn);
        // Extract just the function signature portion from the snapshot
        const expectedRawSig = fnSnap.sig.replace(/\s+\w+(?=[,)])/g, ""); // strip param names
        // Simple param count check
        const expectedInputCount = (fnSnap.sig.match(/,/g) || []).length + (fnSnap.sig.includes("()") ? 0 : 1);
        const actualInputCount = abiFn.inputs?.length || 0;
        if (expectedInputCount !== actualInputCount) {
          results.push({
            contract: name,
            type: "error",
            message: `Function '${fnName}' params changed: expected ${expectedInputCount} params, got ${actualInputCount}. Sig was: ${fnSnap.sig}. New: ${actualSig}. Used by: ${fnSnap.used_by.join(", ")}`,
          });
        }
      }
    }

    // 3. Check for new functions (informational)
    const snapFuncNames = new Set(Object.keys(snap.functions));
    for (const fn of abiFunctions) {
      if (fn.name && !snapFuncNames.has(fn.name)) {
        // Exclude standard inherited functions
        const inherited = [
          "supportsInterface", "balanceOf", "balanceOfBatch", "setApprovalForAll",
          "isApprovedForAll", "safeTransferFrom", "safeBatchTransferFrom",
          "name", "symbol", "decimals", "totalSupply", "transfer", "approve",
          "transferFrom", "allowance", "ownerOf", "getApproved", "tokenURI",
          "owner", "renounceOwnership", "transferOwnership",
          "hasRole", "getRoleAdmin", "grantRole", "revokeRole", "renounceRole",
          "isTrustedForwarder",
          "isValidSignature", "isValidSigner",
          "onERC721Received", "onERC1155Received", "onERC1155BatchReceived",
          "trustedForwarder", "uri",
        ];
        // Also skip public getters for state_variables, constants, and roles in snapshot
        const stateVarNames = Object.keys(snap.state_variables || {});
        const constNames = Object.keys(snap.constants || {});
        const roleNames = Object.keys(snap.roles || {});
        const knownGetters = [...inherited, ...stateVarNames, ...constNames, ...roleNames];
        if (!knownGetters.includes(fn.name)) {
          results.push({
            contract: name,
            type: "warning",
            message: `New function '${fn.name}' added: ${abiSig(fn)}. May need frontend integration or test coverage.`,
          });
        }
      }
    }

    // 4. Check events
    const abiEvents = abi.filter((i) => i.type === "event");
    const abiEventNames = new Set(abiEvents.map((e) => e.name));
    for (const [evName] of Object.entries(snap.events)) {
      if (!abiEventNames.has(evName)) {
        results.push({
          contract: name,
          type: "error",
          message: `Event '${evName}' removed! Frontend event listeners and test assertions will break.`,
        });
      }
    }
    for (const ev of abiEvents) {
      const inheritedEvents = [
        "Transfer", "Approval", "ApprovalForAll", "OwnershipTransferred",
        "RoleGranted", "RoleRevoked", "RoleAdminChanged",
        "TransferSingle", "TransferBatch", "URI",
      ];
      if (ev.name && !snap.events[ev.name] && !inheritedEvents.includes(ev.name)) {
        results.push({
          contract: name,
          type: "warning",
          message: `New event '${ev.name}': ${abiEventSig(ev)}. Consider adding frontend listener.`,
        });
      }
    }
  }

  // ── Output ─────────────────────────────────────────────────

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║       CONTRACT INTERFACE DIFF REPORT                ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const errors = results.filter((r) => r.type === "error");
  const warnings = results.filter((r) => r.type === "warning");

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ All contract interfaces match the snapshot. No breaking changes detected.\n");
    process.exit(0);
  }

  if (errors.length > 0) {
    console.log(`🔴 ${errors.length} BREAKING CHANGE(S):\n`);
    for (const e of errors) {
      console.log(`  [${e.contract}] ${e.message}\n`);
    }
  }

  if (warnings.length > 0) {
    console.log(`🟡 ${warnings.length} WARNING(S):\n`);
    for (const w of warnings) {
      console.log(`  [${w.contract}] ${w.message}\n`);
    }
  }

  console.log("─".repeat(56));
  console.log("\nFiles to update when breaking changes are found:");
  console.log("  1. scripts/deploy.ts      — constructor args, deployment order");
  console.log("  2. scripts/wire.ts         — wiring calls (roles, items, badges, pools)");
  console.log("  3. test/shared/fixtures.ts — deployFullEcosystem() must mirror deploy+wire");
  console.log("  4. test/*.test.ts          — individual test files for changed contracts");
  console.log("  5. deployed-addresses.json — re-deploy and update addresses");
  console.log("  6. typechain-types/        — run 'npx hardhat compile' to regenerate\n");

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
