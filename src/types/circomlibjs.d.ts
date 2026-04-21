declare module "circomlibjs" {
  interface PoseidonFunction {
    (inputs: (bigint | Uint8Array)[]): Uint8Array;
    F: {
      toString(value: Uint8Array | bigint): string;
    };
  }

  export function buildPoseidon(): Promise<PoseidonFunction>;
}
