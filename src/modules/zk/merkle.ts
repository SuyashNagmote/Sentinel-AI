import { buildPoseidon } from "circomlibjs";
import { logDebug, logInfo } from "@/src/modules/observability/logger";

type PoseidonNode = bigint | Uint8Array;

let poseidon: Awaited<ReturnType<typeof buildPoseidon>>;
const tree: bigint[] = [];

/** Tree depth — supports 2^20 = ~1,048,576 leaves */
const TREE_DEPTH = 20;

export async function initMerkleTree() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
    logInfo("merkle.initialized", { depth: TREE_DEPTH, maxLeaves: Math.pow(2, TREE_DEPTH) });
  }
}

export async function insertLeaf(leaf: bigint) {
  await initMerkleTree();
  tree.push(leaf);
  logDebug("merkle.leaf_inserted", { index: tree.length - 1, totalLeaves: tree.length });
  return tree.length - 1;
}

export async function getMerklePath(index: number) {
  await initMerkleTree();

  if (index < 0 || index >= tree.length) {
    throw new Error(`Merkle index ${index} out of bounds (tree has ${tree.length} leaves)`);
  }

  let currentLevel: PoseidonNode[] = [...tree];
  const path: string[] = [];
  const indices: number[] = [];

  let currentIndex = index;

  // Compute path up to TREE_DEPTH levels (or until level collapses to root)
  const effectiveDepth = Math.min(TREE_DEPTH, Math.max(1, Math.ceil(Math.log2(tree.length || 1)) + 1));

  for (let i = 0; i < effectiveDepth; i++) {
    const isRightNode = currentIndex % 2 !== 0;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

    const sibling = siblingIndex < currentLevel.length ? currentLevel[siblingIndex] : 0n;

    path.push(poseidon.F.toString(sibling));
    indices.push(isRightNode ? 1 : 0);

    const nextLevel: PoseidonNode[] = [];
    for (let j = 0; j < currentLevel.length; j += 2) {
      const left = currentLevel[j];
      const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : 0n;
      nextLevel.push(poseidon([left, right]));
    }
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  const root = currentLevel.length > 0 ? poseidon.F.toString(currentLevel[0]) : "0";

  logDebug("merkle.path_computed", {
    index,
    pathLength: path.length,
    effectiveDepth,
    rootPrefix: root.slice(0, 16) + "...",
  });

  return {
    root,
    path,
    indices,
  };
}

export function getTreeSize(): number {
  return tree.length;
}
