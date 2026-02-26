/**
 * Database seed script.
 * Usage: npm run seed (from root or packages/api)
 */
async function seed(): Promise<void> {
  console.log('Seed script placeholder — no database connection configured yet.');
  console.log('This will be implemented in a future PR.');
}

async function main(): Promise<void> {
  await seed();
}

void main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exitCode = 1;
});
