import { db } from "../db/index.js";

const p = db.prepare("DELETE FROM promotions WHERE id LIKE 'test-%'").run();
const b = db.prepare("DELETE FROM brands WHERE id LIKE 'test-%'").run();
console.log(`Deleted ${p.changes} test promotions and ${b.changes} test brands`);