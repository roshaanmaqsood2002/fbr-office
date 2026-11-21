import { app } from "./app";
import { env } from "./config/env";
import { connectDb, disconnectDb } from "./config/db";
import { startSubmissionWorker } from "./modules/fbr/fbr.worker";

async function main() {
  const stopWorker = startSubmissionWorker();

  await connectDb();
  const server = app.listen(env.PORT, () =>
    console.log(`API running on http://localhost:${env.PORT}`),
  );

  const shutdown = async () => {
    server.close();
    await disconnectDb();
    stopWorker();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
