import fs from "node:fs";
const j = JSON.parse(fs.readFileSync("src/core/oreki-tutorial-data.json","utf-8"));
for (const i of [1,2,3,6,7]) {
  const c = j.chapters[i];
  console.log(`\n######## chapters.${i} ${c.title}`);
  console.log("buyOrder:", JSON.stringify(c.buyOrder,null,1));
  console.log("automation:", c.automation);
}
