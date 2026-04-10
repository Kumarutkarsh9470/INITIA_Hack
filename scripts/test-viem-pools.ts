import { createPublicClient, http } from 'viem';
import * as fs from 'fs';

const abi = JSON.parse(fs.readFileSync('./frontend/src/lib/abis/PixelVaultDEX.json', 'utf-8'));
const addr = JSON.parse(fs.readFileSync('./deployed-addresses.json', 'utf-8'));

const client = createPublicClient({ transport: http('http://localhost:8545') });
const dungeonId = '0x8a7faac11b689a5f91556fc9d00fefebcd250de9c9f98f764e8d91ef11653098';

async function main() {
  const result = await client.readContract({
    address: addr.PixelVaultDEX as `0x${string}`,
    abi,
    functionName: 'pools',
    args: [dungeonId],
  });
  
  console.log('type:', typeof result);
  console.log('isArray:', Array.isArray(result));
  console.log('raw:', JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  
  const r = result as any;
  console.log('r.reservePXL:', r.reservePXL?.toString());
  console.log('r.reserveGame:', r.reserveGame?.toString());
  console.log('r[0]:', r[0]?.toString());
  console.log('r[1]:', r[1]?.toString());
  console.log('r[2]:', r[2]?.toString());
}

main().catch(console.error);
