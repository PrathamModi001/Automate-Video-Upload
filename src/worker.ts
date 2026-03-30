// Main polling loop
// 1. GET /pending → activity or sleep
// 2. Download videos from 100ms
// 3. Upload to Bunny via TUS
// 4. Report status back to LMS-BE
// 5. Immediately check next (no sleep between jobs)

import { config } from "./config";

// In-memory set to prevent double-processing
const processing = new Set<string>();

// TODO: implement in execution phase
