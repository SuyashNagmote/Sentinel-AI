import { Interface, MaxUint256, parseUnits } from "ethers";

const erc20 = new Interface([
  "function approve(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)"
]);

export const demoTransactions = [
  {
    id: "safe-transfer",
    title: "Routine USDC transfer",
    description: "A standard low-risk payment to a known recipient.",
    payload: {
      chainId: 1,
      from: "0xA11ce00000000000000000000000000000001234",
      to: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      value: "0",
      data: erc20.encodeFunctionData("transfer", [
        "0x1111111111111111111111111111111111111111",
        parseUnits("125", 6)
      ]),
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      trusted: true,
      metadata: {
        source: "Treasury payout",
        dappName: "Aegis Payroll",
        url: "https://payroll.aegis.local",
        intent: "send"
      }
    }
  },
  {
    id: "unlimited-approval",
    title: "Unlimited approval request",
    description: "A common wallet-drain pattern disguised as a routine approval.",
    payload: {
      chainId: 1,
      from: "0xA11ce00000000000000000000000000000001234",
      to: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      value: "0",
      data: erc20.encodeFunctionData("approve", [
        "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
        MaxUint256
      ]),
      tokenSymbol: "USDC",
      tokenDecimals: 6,
      trusted: false,
      metadata: {
        source: "Claim airdrop",
        dappName: "FreeYield Pro",
        url: "https://freeyield-security-check.example",
        intent: "claim"
      }
    }
  },
  {
    id: "native-drain",
    title: "High value native transfer",
    description: "A direct transfer that could empty the wallet if approved blindly.",
    payload: {
      chainId: 1,
      from: "0xA11ce00000000000000000000000000000001234",
      to: "0xFaCefAceFaCefAceFaCefAceFaCefAceFaCe0002",
      value: "4.25",
      data: "0x",
      trusted: false,
      metadata: {
        source: "Urgent verification request",
        dappName: "Wallet Verify",
        url: "https://wallet-verify-now.example",
        intent: "other"
      }
    }
  }
] as const;

export const defaultDemoTransaction = demoTransactions[1].payload;
