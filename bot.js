require("dotenv").config();
const fs = require("fs");
const Eris = require("eris");

const init = async () => {
	try { 
		require("./auth.json");
		throw new Error("outdated");
	} catch(e) { 
		if(e.message == "outdated") throw new Error("auth.json is outdated, please use the .env file instead! See the github page for more info");
	}

	const bot = new Eris(process.env.DISCORD_TOKEN, {
		maxShards: "auto",
		disableEvents: {
			GUILD_BAN_ADD: true,
			GUILD_BAN_REMOVE: true,
			MESSAGE_DELETE: true,
			MESSAGE_DELETE_BULK: true,
			MESSAGE_UPDATE: true,
			TYPING_START: true,
			VOICE_STATE_UPDATE: true
		},
		messageLimit: 0,
	});

	bot.db = require("./modules/db");
	await bot.db.init();

	bot.recent = {};
	bot.pages = {};

	bot.cmds = {};

	bot.owner = process.env.DISCORD_OWNERID;
  
	require("./modules/util")(bot);
  
	bot.logger = require("./modules/logger");
  
	console.log("COMMANDS:");
	let files = fs.readdirSync("./commands");
	files.forEach(file => {
		process.stdout.write(` ${file}`);
		bot.cmds[file.slice(0,-3)] = require("./commands/"+file);
	});
  
	console.log("\nEVENTS:");
	files = fs.readdirSync("./events");
	files.forEach(file => {
		process.stdout.write(` ${file}`);
		bot.on(file.slice(0,-3), (...args) => require("./events/"+file)(...args,bot));
	});
	console.log();

	if (!process.env.DISCORD_INVITE) {
		delete bot.cmds.invite;
	}

	bot.connect();
};

init().catch(console.error);