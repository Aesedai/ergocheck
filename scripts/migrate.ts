import { closePool, getPool } from '../src/server/db.js';
import { migrate } from '../src/server/migrate.js';

const ran = await migrate(getPool(), console.log);
console.log(ran.length ? `${ran.length} migration(s) applied` : 'database is up to date');
await closePool();
