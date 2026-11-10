const list = await (await fetch("http://127.0.0.1:9224/json/list")).json();
console.log(list.map(t => `${t.type} | ${t.url} | ${t.id.slice(0,8)}`).join("\n"));
