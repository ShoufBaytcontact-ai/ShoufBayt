import { publishAllAgentInventoryListings } from "./lib/publishAgentInventory.js";

const published = await publishAllAgentInventoryListings();
console.log(`Published ${published} agent listings`);
process.exit(0);
