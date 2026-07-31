import { MongoClient } from "mongodb";
import { initDb } from "./init-db.js";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "qrcode_saas";

async function main() {
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await initDb(db);
  await client.close();
  console.log(`Database ${dbName} initialized`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
