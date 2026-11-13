import { connectDatabase, disconnectDatabase } from '../config/database';
import { logger } from '../config/logger';
import { runMaintenance } from '../jobs/maintenance.jobs';

/**
 * Manual maintenance trigger for operators. The API also runs the same job at
 * startup and on MAINTENANCE_INTERVAL_MINUTES, so this is only needed for a
 * one-off repair or verification run.
 */
async function main(): Promise<void> {
  await connectDatabase();
  const result = await runMaintenance();
  console.log(JSON.stringify(result, null, 2));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Manual maintenance run failed');
  try {
    await disconnectDatabase();
  } catch {
    // Preserve the original failure.
  }
  process.exitCode = 1;
});
