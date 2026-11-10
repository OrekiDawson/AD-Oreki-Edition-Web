const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
for (let i = 0; i < 10; i++) await sleep(250);
console.log("elapsed(ms)=", Date.now() - t0);
