const request = require("got");
const strlen = require("string-length");
let tagRegex = /(@[\s\S]+?#0000|@\S+)/g;

module.exports = {

	checkMember: (msg, member, clean) => {
		for(let i=0; i<member.brackets.length/2; i++) {
			if(clean.startsWith(member.brackets[i*2]) && clean.endsWith(member.brackets[i*2+1]) && ((clean.length == (member.brackets[i*2].length + member.brackets[i*2+1].length) && msg.attachments[0]) || clean.length > (member.brackets[i*2].length + member.brackets[i*2+1].length)))
				return i;
		}
		return -1;
	},

    fetchWebhook: async (bot, channel) => {
        let q = await bot.db.webhooks.get(channel.id);
        if(q.rows[0]) {
            try {
                if (await bot.getWebhook(q.id, q.token)) return q;
            } catch (e) {
                if (e.code != 10015) throw e;
                await bot.db.webhooks.delete(channel.id);
                return await module.exports.fetchWebhook(bot, channel);
            }
        }
        else if(!channel.permissionsOf(bot.user.id).has("manageWebhooks"))
            throw { permission: "Manage Webhooks" };
        else {
            let hook;
            try {
                hook = await channel.createWebhook({ name: "Tupperhook" });
            } catch(e) {
                if(e.code == 30007) {
                    let wbhooks = await channel.getWebhooks();
                    for(let i=0; i<wbhooks.length; i++) {
                        if(wbhooks[i].user.id == bot.user.id) await bot.deleteWebhook(wbhooks[i].id,wbhooks[i].token);
                    }
                    if(wbhooks.length == 10) hook = wbhooks[9];
                    else hook = await channel.createWebhook({ name: "Tupperhook" });
                } else if(e.code != 10003) throw e;
            }
            let wbhk = { id: hook.id, channel_id: channel.id, token: hook.token };
            await bot.db.webhooks.set(wbhk);
            return wbhk;
        }
    },

    getAttachments: async (msg) => {
        let files = [];
        for(let i = 0; i < msg.attachments.length; i++) {
            let head;
            try {
                head = await request.head(msg.attachments[i].url);
            } catch(e) { }
            if(head && head.headers["content-length"] && Number(head.headers["content-length"]) > 8388608) throw new Error("toolarge");
            files.push({ file: (await request(msg.attachments[i].url, {encoding: null})).body , name: msg.attachments[i].filename });
        }
        return files;
    },

    cleanName: (bot, msg, un) => {
        //discord treats astral characters (many emojis) as one character, so add an invisible char to make it two
        let len = strlen(un);
        if(len == 0) un += "\u17B5\u17B5";
        else if(len == 1) un += "\u17B5";

        //discord collapses same-name messages, so if two would be sent by different users, break them up with a tiny space
        if(bot.recent[msg.channel.id] && msg.author.id !== bot.recent[msg.channel.id][0].user_id && un === bot.recent[msg.channel.id][0].name) {
            un = un.substring(0,1) + "\u200a" + un.substring(1);
        }

        //discord prevents the name 'clyde' being used in a webhook, so break it up with a tiny space
        un = un.replace(/(c)(lyde)/gi, "$1\u200a$2");
        if(un.length > 80) un = un.slice(0,78) + "..";

        return un;
    },

    getName: async (bot, member) => 
        `${member.name}${member.tag ? " " + member.tag : ""}${bot.checkMemberBirthday(member) ? "\uD83C\uDF70" : ""}${member.group_id ? " " + (await bot.db.groups.getByID(member.group_id)).tag : ""}`.trim(),

    getRecentMentions: (bot, msg, content) =>
        bot.recent[msg.channel.id] ? content.replace(tagRegex,match => {
            let includesDiscrim = match.endsWith("#0000");
            let found = bot.recent[msg.channel.id].find(r => (includesDiscrim ? r.name == match.slice(1,-5) : r.rawname.toLowerCase() == match.slice(1).toLowerCase()));
            return found ? `${includesDiscrim ? match.slice(0,-5) : match} (<@${found.user_id}>)` : match;
        }) : content,

    logProxy: async (bot, msg, cfg, member, content, webmsg) => {
        if(cfg.log_channel && msg.channel.guild.channels.has(cfg.log_channel)) {
            let logchannel = msg.channel.guild.channels.get(cfg.log_channel);
            if(logchannel.type != 0 || typeof(logchannel.createMessage) != "function") {
                cfg.log_channel = null;
                bot.send(msg.channel, "Warning: There is a log channel configured but it is not a text channel. Logging has been disabled.");
                await bot.db.config.update(msg.channel.guild.id,"log_channel",null,bot.defaultCfg);
            }
            else if(!logchannel.permissionsOf(bot.user.id).has("sendMessages") || !logchannel.permissionsOf(bot.user.id).has("readMessages")) {
                bot.send(msg.channel, "Warning: There is a log channel configured but I do not have permission to send messages to it. Logging has been disabled.");
                await bot.db.config.update(msg.channel.guild.id,"log_channel",null,bot.defaultCfg);
            }
            else bot.send(logchannel, {embed: {
                title: member.name,
                description: content + "\n",
                fields: [
                    { name: "Registered by", value: `<@!${msg.author.id}> (${msg.author.id})`, inline: true},
                    { name: "Channel", value: `<#${msg.channel.id}> (${msg.channel.id})`, inline: true },
                    { name: "\u200b", value: "\u200b", inline: true},
                    { name: "Original Message", value: `[jump](https://discord.com/channels/${msg.channel.guild ? msg.channel.guild.id : "@me"}/${msg.channel.id}/${webmsg.id})`, inline: true},
                    { name: "Attachments", value: msg.attachments[0] ? msg.attachments.map((att, i) => `[link ${i+1}](${att.url})`).join(', ') : "None", inline: true},
                    { name: "\u200b", value: "\u200b", inline: true},
                ],
                thumbnail: {url: member.avatar_url},
                footer: {text: `Message ID ${webmsg.id}`}
            }});
        }
    },

    updateRecent: (bot, msg, data) => {
        if(!bot.recent[msg.channel.id]) {
            bot.recent[msg.channel.id] = [];
        }
        bot.recent[msg.channel.id].unshift(data);
        if(bot.recent[msg.channel.id].length > 5) bot.recent[msg.channel.id] = bot.recent[msg.channel.id].slice(0,5);
    },

    replaceMessage: async (bot, msg, cfg, member, content, retry = 2) => {
    
        if (retry = 0) return;
    
        const hook = await module.exports.fetchWebhook(bot, msg.channel);
    
        let ratelimit = bot.requestHandler.ratelimits[`/webhooks/${hook.id}/:token?wait=true`];
        if(ratelimit && ratelimit._queue.length > 5) {
            let res = { message: "autoban",  notify: false };
            //ratelimit._queue = [];
            if(!ratelimit.expire || Date.now() > ratelimit.expire) {
                ratelimit.expire = Date.now() + 10000;
                res.notify = true;
            }
            throw res;
        }
    
        const data = {
            wait: true,
            content: module.exports.getRecentMentions(bot, msg, content),
            username: module.exports.cleanName(bot, msg, await module.exports.getName(bot, member)),
            avatarURL: member.avatar_url,
        };
    
		if(msg.attachments[0]) data.file = await module.exports.getAttachments(msg);

        if(data.content.trim().length == 0 && !data.attachments) throw { message: "empty" };
    
        let webmsg;
        try {
            webmsg = await bot.executeWebhook(hook.id,hook.token,data);
        } catch (e) {
            if(e.code == 504 || e.code == "EHOSTUNREACH") {
                return await module.exports.replaceMessage(bot, msg,cfg,member,content,retry-1);
            } else if(e.code == 40005) {
                throw new Error("toolarge");
            } else throw e;
        }
    
        module.exports.logProxy(bot, msg, cfg, member, content, webmsg);
    
        bot.db.members.update(member.user_id,member.name,"posts",member.posts+1);
    
        if(!bot.recent[msg.channel.id] && !msg.channel.permissionsOf(bot.user.id).has("manageMessages"))
            bot.send(msg.channel, "Warning: I do not have permission to delete messages. Both the original message and proxied message will show.");
    
        module.exports.updateRecent(bot, msg, {
            user_id: msg.author.id,
            name: data.username,
            rawname: member.name,
            id: webmsg.id,
            tag: `${msg.author.username}#${msg.author.discriminator}`
        });

        return true;
    },

    findInMessage: (bot, msg, members, cfg) => {

        let clean = msg.cleanContent || msg.content;
        clean = clean.replace(/(<a?:.+?:\d+?>)|(<@!?\d+?>)/,"cleaned");
        let cleanarr = clean.split("\n");
        let lines = msg.content.split("\n");
        let replace = [];
        let current = null;

        for(let i = 0; i < lines.length; i++) {
            let found = false;
            members.forEach(t => {
                let res = module.exports.checkMember(msg, t, cleanarr[i]);
                if(res >= 0) {
                    if(t.brackets[res*2+1].length == 0) current = t;
                    else current = null;
                    found = true;
                    replace.push([msg,cfg,t,t.show_brackets ? lines[i] : lines[i].substring(t.brackets[res*2].length, lines[i].length-t.brackets[res*2+1].length)]);
                }
            });
            if(!found && current) 
                replace[replace.length-1][3] += "\n"+lines[i];
        }
    
        if(replace.length < 2) replace = [];
    
        if(!replace[0]) {
            for(let t of members) {
                let res = module.exports.checkMember(msg, t, clean);
                if(res >= 0) {
                    replace.push([msg, cfg, t, t.show_brackets ? msg.content : msg.content.substring(t.brackets[res*2].length, msg.content.length-t.brackets[res*2+1].length)]);
                    break;
                }
            }
        }

        return replace;
    },

    executeProxy: async ({msg,bot,members,cfg}) => {

        let replace = module.exports.findInMessage(bot, msg, members, cfg);
    
        if(!replace[0]) return false;
    
        try {
            if(replace.length > 7) {
                //console.log(`Potential abuse by ${msg.author.id} - ${replace.length} proxies at once in ${msg.channel.id}!`);
                return bot.send(msg.channel, `Proxy refused: too many proxies in one message!`);
            }
            for(let r of replace) {
                await module.exports.replaceMessage(bot, ...r);
            }
            let perms = msg.channel.permissionsOf(bot.user.id);
            if(perms.has("manageMessages") && perms.has("readMessages"))
                process.send({name: "queueDelete", channelID: msg.channel.id, messageID: msg.id}, null, {swallowErrors: false}, err => {
                    if(err) console.log(err)
                });
            return true;
        } catch(e) { 
            if(e.message == "empty") bot.send(msg.channel, "Cannot proxy empty message.");
            else if(e.permission == "Manage Webhooks") bot.send(msg.channel, "Proxy failed because I don't have 'Manage Webhooks' permission in this channel.");
            else if(e.message == "toolarge") bot.send(msg.channel, "Message not proxied because bots can't send attachments larger than 8mb. Sorry!");
            else if(e.message == "autoban") {
                if(e.notify) bot.send(msg.channel, "Proxies refused due to spam!");
                console.log(`Potential spam by ${msg.author.id}!`);
            } 
            else if(e.code != 10008) bot.err(msg, e); //discard "Unknown Message" errors
        }
    }
}