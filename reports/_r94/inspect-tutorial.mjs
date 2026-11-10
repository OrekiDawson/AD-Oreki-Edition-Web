import fs from "node:fs";
const j = JSON.parse(fs.readFileSync("src/core/oreki-tutorial-data.json","utf-8"));
const walk = (o, path=[]) => {
  if (o && typeof o === "object") {
    if (Array.isArray(o)) { o.forEach((v,i)=>walk(v,[...path,i])); }
    else {
      if (o.title) console.log([...path].join("."), "|", o.title, "| keys:", Object.keys(o).join(","));
      for (const [k,v] of Object.entries(o)) if (v && typeof v === "object") walk(v,[...path,k]);
    }
  }
};
walk(j);
