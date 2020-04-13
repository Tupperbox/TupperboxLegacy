const cluster = require("cluster");
const os = require("os");
const enqueue = require("./queue");

const dhm = t => {
	let cd = 24 * 60 * 60 * 1000, ch = 60 * 60 * 1000, cm = 60 * 1000, cs = 1000;
	let d = Math.floor(t/cd), h = Math.floor((t-d*cd)/ch), m = Math.floor((t-d*cd-h*ch)/cm), s = Math.floor((t-d*cd-h*ch-m*cm)/cs);
	return `${d}d ${h}h ${m}m ${s}s`;
};

if(cluster.isMaster) {
	module.exports = {
		postStats: (wrk,msg,shrd) => {
			if(!msg.channelID) return;
			let guilds = shrd.stats.stats.clusters.reduce((a,b)=>a+b.guilds,0);
			shrd.eris.createMessage(msg.channelID,
				"```"+shrd.stats.stats.clusters.sort((a,b) => a.cluster-b.cluster).map(c => 
					`Cluster ${c.cluster+1}${c.cluster < 9 ? " " : ""} - ${c.shards} shards -- ${c.ram.toFixed(1)} MB RAM -- ${c.guilds} servers (up ${dhm(c.uptime)})`).join("\n")
				+`\n\nTotal memory used: ${(shrd.stats.stats.totalRam/1000000).toFixed(1)} MB/${(os.totalmem()/1000000).toFixed(1)} MB\nTotal servers: ${guilds}\n\nRequest received on Shard ${msg.shard} (Cluster ${wrk.id})` + "```"
			);
		},
		queueDelete: (wrk, msg, shrd) => {
			if(!msg.channelID || !msg.messageID) return;
			enqueue(msg);
		}
	};
} else {
	module.exports = bot => {
		bot.ipc = {
			reload: async msg => {
				if(!msg.type || !msg.targets || !msg.channel) return;
				let out = "";
				for(let arg of msg.targets) {
					try {
						let path = `../${msg.type}s/${arg}`;
						let fullPath = require.resolve(path);
						if(msg.type == "command") {
							delete require.cache[fullPath];
							bot.cmds[arg] = require(path);
						} else if(msg.type == "module") {
							delete require.cache[fullPath];
							switch(arg) {
							case "util":
								require("../modules/util")(bot);
								break;
							case "logger":
								bot.logger = require("../modules/logger");
								break;
							case "db":
								await bot.db.end();
								bot.db = require("../modules/db");
								break;
							case "errors":
								break;
							case "ipc":
								process.send({name:"reloadIPC"});
								require("../modules/ipc")(bot);
								break;
							case "blacklist":
								bot.blacklist = require("../modules/blacklist.json");
								break;
							}
						} else if(msg.type == "event") {
							bot.removeAllListeners(arg);
							delete require.cache[fullPath];
							let func = require(path);
							bot.on(arg, (...a) => func(...a,bot));
						}
						out += `${arg} reloaded\n`;
					} catch(e) {
						out += `Could not reload ${arg} (${e.code}) - ${e.stack}\n`;
					}
				}
				console.log(`${out}`);
			}
		};
	};
}