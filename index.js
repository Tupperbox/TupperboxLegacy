require("dotenv").config();
const Sharder = require("eris-sharder").Master;
const cluster = require("cluster");

const init = async () => {
	if(cluster.isMaster) {
		try { 
			require("./auth.json");
			throw new Error("outdated");
		} catch(e) { 
			if(e.message == "outdated") throw new Error("auth.json is outdated, please use the .env file instead! See the github page for more info");
		}

		await require("./modules/db").init();
	}

	let sharder = new Sharder("Bot " + process.env.DISCORD_TOKEN,"/bot.js",{
		clientOptions: {
			disableEvents: {
				GUILD_BAN_ADD: true,
				GUILD_BAN_REMOVE: true,
				MESSAGE_DELETE: true,
				MESSAGE_DELETE_BULK: true,
				TYPING_START: true,
				VOICE_STATE_UPDATE: true
			},
			messageLimit: 0,
			guildSubscriptions: false,
			restMode: true,
			ratelimiterOffset: 5,
			intents: [
				"guilds",
				"guildMembers",
				"guildMessages",
				"guildMessageReactions",
				"directMessages",
				"directMessageReactions"
			],
			maxConcurrency: "auto"
		},
		stats: true,
		debug: true,
		shards: +process.env.SHARDS,
		clusters: +process.env.CLUSTERS || process.env.DEV? 1 : undefined,
		name: "Tupperbox",
		clusterTimeout: 0.1
	});

	sharder.eris.on("debug",console.log);
	

	if(cluster.isMaster) {
		let events = require("./modules/ipc.js");

		cluster.on("message",(worker,message) => {
			if(message.name == "reloadIPC") {
				delete require.cache[require.resolve("./modules/ipc.js")];
				events = require("./modules/ipc.js");
				console.log("Reloaded IPC plugin!");
			} else if(events[message.name]) {
				events[message.name](worker,message,sharder);
			}
		});
	}
};

init();
