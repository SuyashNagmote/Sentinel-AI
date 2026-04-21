import { buildPoseidon } from "circomlibjs";

type PoseidonNode = bigint | Uint8Array;

let poseidon: Awaited<ReturnType<typeof buildPoseidon>>;
const tree: bigint[] = [];
const levels = 3;

export async function initMerkleTree() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
}

export async function insertLeaf(leaf: bigint) {
  await initMerkleTree();
  tree.push(leaf);
  return tree.length - 1;
}

export async function getMerklePath(index: number) {
  await initMerkleTree();
  
  let currentLevel: PoseidonNode[] = [...tree];
  const path: string[] = [];
  const indices: number[] = [];
  
  let currentIndex = index;

  for (let i = 0; i < levels; i++) {
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
  
  return {
    root,
    path,
    indices
  };
}
