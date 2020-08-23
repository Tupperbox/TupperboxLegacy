const request = require("got");
const strlen = require("string-length");

let tagRegex = /(@[\s\S]+?#0000|@\S+)/g;
let ignoreEvents = ['INVITE_CREATE','INVITE_DELETE'];

module.exports = bot => {  
	bot.cooldowns = {};

	bot.getMessageContext = async (msg) => {
		if(msg.author.bot) return { done: true };
		if(msg.channel.guild && bot.blacklist.includes(msg.channel.guild.id)) return { done : true };
		if(await bot.db.getGlobalBlacklisted(msg.author.id)) return { done: true };
	
		let cfg = guild ? (await bot.db.config.get(guild.id) ?? { ...bot.defaultCfg }) : { ...bot.defaultCfg };
		let members = bot.db.members.getAll(msg.author.id);
		return { msg, bot, cfg, members };
	}

	bot.err = (msg, error, tell = true) => {
		if(error.message.startsWith("Request timed out") || error.code == 500 || error.code == "ECONNRESET" || error.code == "EHOSTUNREACH") return; //Internal discord errors don't need reporting
		console.error(`[ERROR ch:${msg.channel.id} usr:${msg.author ? msg.author.id : "UNKNOWN"}]\n(${error.code}) ${error.stack} `);
		if(tell && msg.channel) bot.send(msg.channel,`There was an error performing the operation. Please report this to the support server if issues persist. (${error.code || error.message})`).catch(e => {});
		bot.sentry.captureException(error);
	};

	bot.updateStatus = async () => {
		bot.editStatus({ name: `${bot.defaultCfg.prefix}help | ${(+(await bot.db.members.count()).toLocaleString())} registered`});
	};

	bot.ageOf = user => {
		return (Date.now() - user.createdAt)/(1000*60*60*24);
	};

	bot.getBrackets = member => {
		let out = [];
		for(let i=0; i<member.brackets.length; i+=2) {
			out.push(member.brackets[i] + "text" + member.brackets[i+1]);
		}
		return out.join(" | ");
	};

	bot.findAllUsers = async guildID =>  {
		let targets = [];
		let amtFound = 1000;
		let lastId = "0";
		while(amtFound == 1000) {
			let found = await bot.requestHandler.request("GET", `/guilds/${guildID}/members`, true, {limit:1000,after:lastId});
			amtFound = found.length;
			if(found.length > 0) lastId = found[found.length-1].user.id;
			targets = targets.concat(found.map(m => m.user));
		}
		return targets;
	}

	bot.checkMemberBirthday = member => {
		if(!member.birthday) return false;
		let now = new Date();
		return member.birthday.getUTCDate() == now.getUTCDate() && member.birthday.getUTCMonth() == now.getUTCMonth();
	};

    bot.resolveUser = async (msg, text) => {
        let uid = /<@!?(\d+)>/.test(text) && text.match(/<@!?(\d+)>/)[1] || text;
        if (/^\d+$/.test(uid)) {
			let target = null;
			target = await bot.getRESTUser(uid).catch(e => { if(e.code != 10013) throw e; return null }); //return null if user wasn't found, otherwise throw
            if (target && target.user) target = target.user;
            return target;
        } else return null;
	};

	bot.resolveChannel = (msg, text) => {
		let g = msg.channel.guild;
		return g.channels.get(/<#(\d+)>/.test(text) && text.match(/<#(\d+)>/)[1]) || g.channels.get(text); /*|| g.channels.find(m => m.name.toLowerCase() == text.toLowerCase())*/
	};

	bot.checkPermissions = (cmd, msg, args) => {
		return (msg.author.id === bot.owner) || (cmd.permitted(msg,args));
	};

	bot.waitMessage = (msg) => {
		return new Promise((res, rej) => {
			bot.dialogs[msg.channel.id + msg.author.id] = res;
			setTimeout(() => {
				if(bot.dialogs[msg.channel.id + msg.author.id] != undefined) {
					delete bot.dialogs[msg.channel.id + msg.author.id];
					rej("timeout");
				}
			}, 10000);
		});
	};

	bot.send = async (channel, message, file, retry = 2) => {
		if(!channel.id) return;
		let msg;
		try {
			if(bot.announcement && message.embed) {
				if(!message.content) message.content = "";
				message.content += "\n"+bot.announcement;
			}
			msg = await channel.createMessage(message, file);
		} catch(e) {
			if(e.message.startsWith("Request timed out") || (e.code >= 500 && e.code <= 599) || e.code == "EHOSTUNREACH") {
				if(retry > 0) return bot.send(channel,message,file,retry-1);
				else return;
			} else throw e;
		}
		return msg;
	};

	bot.sanitizeName = name => {
		return name.trim();
	};

	bot.noVariation = word => {
		return word.replace(/[\ufe0f]/g,"");
	};

	bot.banAbusiveUser = async (userID, notifyChannelID) => {
		if(userID == bot.user.id) return;
		let membersDeleted = await bot.db.members.clear(userID);
		let blacklistedNum = 0;
		try {
			blacklistedNum = (await bot.db.query("INSERT INTO global_blacklist values($1::VARCHAR(50))",[userID])).rowCount;
		} catch(e) { console.log(e.message); }
		console.log(`blacklisted ${blacklistedNum} user ${userID} and deleted ${membersDeleted.rowCount} tuppers`);
		bot.createMessage(notifyChannelID,`User <@${userID}> (${userID}) is now blacklisted for abuse.`);
	}

	bot.getMatches = (string, regex) => {
		var matches = [];
		var match;
		while (match = regex.exec(string)) {
			match.splice(1).forEach(m => { if(m) matches.push(m); });
		}
		return matches;
	};

	bot.ignoreDeletion = (e) => {
		if(e.code != 10008) throw e;
	}

}
