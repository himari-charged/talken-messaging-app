/**
 * Quai Network wallet and auth helpers per https://docs.qu.ai/sdk/introduction
 * Uses Quais SDK: Provider + Wallet/Signer, signMessage for auth.
 * API compatibility via quai_ namespace; usePathing for remote RPC.
 */
import { quais } from "quais";

const RPC_URL = "https://rpc.quai.network";
const PROVIDER_OPTIONS = { usePathing: true };

/** Hex private key length (32 bytes = 64 hex chars, optional 0x prefix) */
const PRIVATE_KEY_HEX_LENGTH = 64;
const MAX_PRIVATE_KEY_LENGTH = 66; // 0x + 64

/**
 * Create a read-only Provider for Quai Network (per docs).
 * Use with Wallet for read-and-write (Provider + Signer).
 */
export function createProvider(): quais.JsonRpcProvider {
  return new quais.JsonRpcProvider(RPC_URL, undefined, PROVIDER_OPTIONS);
}

/**
 * Detect Pelagus injected provider (browser only).
 * Per docs: BrowserProvider(window.pelagus) for wallet connection.
 */
export function hasPelagus(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { pelagus?: unknown }).pelagus !== "undefined";
}

/**
 * Create a BrowserProvider for Pelagus (browser only).
 * Returns null if not in browser or Pelagus not installed.
 */
export function createBrowserProvider(): quais.BrowserProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { pelagus?: unknown };
  if (!w.pelagus) return null;
  // Pelagus injects EIP-1193 provider per https://docs.qu.ai/sdk/introduction
  return new quais.BrowserProvider(w.pelagus as any);
}

/**
 * Validate private key format (hex, 32 bytes) without creating a Wallet.
 * Fails fast and avoids leaking key material in errors.
 */
export function isValidPrivateKeyFormat(value: string): boolean {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_PRIVATE_KEY_LENGTH) return false;
  const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  if (hex.length !== PRIVATE_KEY_HEX_LENGTH) return false;
  return /^[0-9a-fA-F]+$/.test(hex);
}

/**
 * Create a Wallet from a private key (hex string, with or without 0x).
 * Connects to Quai mainnet RPC per docs. Validates format before use.
 */
export function createWalletFromPrivateKey(privateKey: string): quais.Wallet {
  if (!isValidPrivateKeyFormat(privateKey)) {
    throw new Error("Invalid private key format");
  }
  const provider = createProvider();
  const key = privateKey.trim().startsWith("0x") ? privateKey.trim() : `0x${privateKey.trim()}`;
  return new quais.Wallet(key, provider);
}

/**
 * Sign a message for login/auth. Includes nonce to prevent replay.
 * Backend/caller can verify ownership via verifyMessage.
 */
export async function signLoginMessage(
  wallet: quais.Wallet,
  nonce: string
): Promise<{ message: string; signature: string }> {
  const message = `Sign in to Talken\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
  const signature = await wallet.signMessage(message);
  return { message, signature };
}

/**
 * Verify that a signature was produced by the signer of the message.
 * Returns the recovered address (per Quais hash.verifyMessage).
 */
export function verifyMessage(message: string, signature: string): string {
  return quais.verifyMessage(message, signature);
}

/**
 * Normalize and validate a Quai address (per docs address utilities).
 * Uses getAddress for checksum and validation.
 */
export function normalizeAddress(address: string): string {
  return quais.getAddress(address?.trim());
}

/** Validate a Quai address. Uses SDK isAddress. */
export function isValidAddress(address: string): boolean {
  try {
    return quais.isAddress(address?.trim());
  } catch {
    return false;
  }
}

/** Check if address is a valid Quai (account) address (not Qi). */
export function isQuaiAddress(address: string): boolean {
  try {
    return quais.isQuaiAddress(address?.trim());
  } catch {
    return false;
  }
}

/** 1 QUAI = 10^18 wei (same as Ethereum) */
const WEI_PER_QUAI = BigInt("1000000000000000000");

/**
 * Parse a human-readable QUAI amount (e.g. "1.5") to wei string.
 * Avoids float precision issues by string-based conversion.
 */
export function parseQuaiToWei(amountStr: string): string {
  const s = amountStr?.trim();
  if (!s || /[^0-9.]/.test(s)) return "0";
  const parts = s.split(".");
  const intPart = parts[0] || "0";
  const decPart = (parts[1] || "").padEnd(18, "0").slice(0, 18);
  const wei = BigInt(intPart) * WEI_PER_QUAI + BigInt(decPart || "0");
  return wei.toString();
}

/**
 * Format wei (string or bigint) to human-readable QUAI string (e.g. "1.500").
 */
export function formatWeiToQuai(wei: string | bigint): string {
  const w = typeof wei === "string" ? BigInt(wei) : wei;
  if (w < 0n) return "0";
  const intPart = w / WEI_PER_QUAI;
  const fracPart = w % WEI_PER_QUAI;
  const fracStr = fracPart.toString().padStart(18, "0").replace(/0+$/, "") || "0";
  return fracStr === "0" ? intPart.toString() : `${intPart}.${fracStr}`;
}

/**
 * Send native QUAI from wallet to recipient. valueWei is the amount in wei (string).
 * Returns transaction hash on success.
 */
export async function sendTransaction(
  wallet: quais.Wallet,
  toAddress: string,
  valueWei: string
): Promise<string> {
  const to = normalizeAddress(toAddress);
  const value = BigInt(valueWei);
  if (value <= 0n) throw new Error("Amount must be positive");
  const tx = await wallet.sendTransaction({
    from: wallet.address,
    to,
    value,
    gasLimit: 21000n,
  });
  const receipt = await tx.wait();
  const hash = receipt?.hash;
  if (!hash) throw new Error("Transaction failed");
  return hash;
}

export type { Wallet } from "quais";
