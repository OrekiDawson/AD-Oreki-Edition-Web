import fs from "node:fs";
const raw = fs.readFileSync("src/core/oreki-tutorial-data.json", "utf-8");
const data = JSON.parse(raw);
const rt = JSON.stringify(data, null, 2);
console.log("raw len:", raw.length, "roundtrip len:", rt.length);
console.log("same (no trailing newline):", raw === rt);
console.log("same (with trailing newline):", raw === rt + "\n");
console.log("raw tail:", JSON.stringify(raw.slice(-20)));
console.log("data keys:", Object.keys(data).join(","));
