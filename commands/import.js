const request = require("got");

module.exports = {
	help: cfg => "Import your data from a file",
	usage: cfg =>  ["import [link] - Attach a compatible .json file or supply a link to a file when using this command. Data files can be obtained from compatible bots like me and Pluralkit."],
	permitted: () => true,
	desc: cfg => "Importing data acts as a merge, meaning if there are any " + cfg.lang + "s already registered with the same name as one being imported, the values will be updated instead of registering a new one.",
	cooldown: msg => 300000,
	execute: async (bot, msg, args, cfg) => {
		let file = msg.attachments[0];
		if(!file) file = args[0];
		if(!file) return "Please attach or link to a .json file to import when running this command.\nYou can get a file by running the export command from me or Pluralkit.";
		let data;
		try {
			data = JSON.parse((await request(msg.attachments[0] ? msg.attachments[0].url : args[0])).body);
		} catch(e) {
			return "Please attach a valid .json file.";
		}

		try {
			await bot.send(msg.channel, "Warning: This will overwrite your data. Only use this command with a recent, untampered .json file generated from the export command from either me or PluralKit. Please reply 'yes' if you wish to continue.");
			let response = await bot.waitMessage(msg);
			if(response.content.toLowerCase() != "yes") return "Canceling operation.";
		} catch(e) {
			if(e == "timeout") return "Response timed out. Canceling.";
			else throw e;
		}
		let uid = msg.author.id;
		
		if(data.tuppers) { //tupperbox file
			if(data.tuppers.length > 3000 || data.groups.length > 500) {
				return "Data too large for import. Please visit the support server for assistance: https://discord.gg/6WF6Z5m";
			}
			let tups = data.tuppers;
			let groups = data.groups;
			let client;
			try {
				client = await bot.db.connect();
				let added = 0;
				let updated = 0;
				let oldGroups = (await client.query("SELECT id, name, description, tag FROM Groups WHERE user_id = $1 ORDER BY position",[msg.author.id])).rows;
				let oldTups = (await client.query("SELECT name, avatar_url, brackets, posts, show_brackets, birthday, description, tag, group_id, group_pos FROM Members WHERE user_id = $1 ORDER BY position", [msg.author.id])).rows;
				await client.query('BEGIN');
				for(let i=0; i<groups.length; i++) {
					let g = groups[i];
					let old = oldGroups.find(gr => g.name == gr.name) || {};
					if(!old.name) { //update existing entry
						added++;
						await bot.db.groups.add(uid,g.name, client);
					} else updated++;
					await client.query("UPDATE Groups SET description = $1, tag = $2 WHERE user_id = $3 AND name = $4",
						[g.description || null, g.tag || null, uid, g.name]);
				}
				for(let i=0; i<tups.length; i++) {
					let t = tups[i];
					let old = oldTups.find(tu => t.name == tu.name) || {};
					if(!old.name) { //update existing entry
						added++;
						await bot.db.members.add(uid,{name: t.name,brackets: t.brackets}, client);
					} else updated++;
					await client.query("UPDATE Members SET avatar_url = $1, posts = $2, show_brackets = $3, birthday = $4, description = $5, tag = $6, brackets = $7 WHERE user_id = $8 AND name = $9",
						[t.avatar_url || old.avatar_url, Math.max(old.posts || 0,t.posts || 0), t.show_brackets || false, t.birthday || null, t.description || null, t.tag || null, t.brackets || old.brackets, uid, t.name]);
					if(old.group_id != t.group_id) {
						let grp = groups.find(g => g.id == t.group_id);
						let validGroup = grp ? (await bot.db.groups.get(uid,grp.name)) : null;
						if(validGroup)
							await client.query("UPDATE Members SET group_id = $1, group_pos = (SELECT GREATEST(COUNT(group_pos),MAX(group_pos)+1) FROM Members WHERE group_id = $1) WHERE user_id = $2 AND name = $3", [validGroup.id,uid, t.name]);
					}
				}
				await client.query('COMMIT');
				return `Import successful. Added ${added} entries and updated ${updated} entries.`;
			} catch(e) {
				bot.err(msg,e,false);
				if(client) await client.query('ROLLBACK');
				return `Something went wrong importing your data. This may have resulted in a partial import. Please check the data and try again. (${e.code || e.message})`;
			} finally {
				if(client) client.release();
			}
		} else if(data.switches) { //pluralkit file
			if(data.members.length > 3000) {
				return "Data too large for import. Please visit the support server for assistance: https://discord.gg/6WF6Z5m";
			}
			let client;
			try {
				client = await bot.db.connect();
				let sysName = data.name || msg.author.username;
				let systemGroup = await bot.db.groups.get(uid,sysName);
				if(!systemGroup) {
					await bot.db.groups.add(uid,sysName);
					await bot.db.query("UPDATE Groups SET description = $1, tag = $2 WHERE user_id = $3 AND name = $4",[data.description || null, data.tag || null, uid, sysName]);
					systemGroup = await bot.db.groups.get(uid, sysName);
				}
				let tups = data.members;
				let added = 0;
				let updated = 0;
				let oldTups = await bot.db.members.getAll(msg.author.id);
				await client.query('BEGIN');
				for(let i=0; i<tups.length; i++) {
					let t = tups[i];
					let old = oldTups.find(tu => t.name == tu.name) || {};
					let newBrackets = (t.proxy_tags.length == 0) ? [`${t.name}:`,""] : t.proxy_tags.map(pt => [pt.prefix ||  "", pt.suffix || ""]).reduce((acc,val) => acc.concat(val),[]);
					if(!old.name) { //update existing entry
						added++;
						await bot.db.members.add(uid,{name:t.name,brackets:newBrackets},client);
					} else updated++;
					await client.query("UPDATE Members SET avatar_url = $1, posts = $2, birthday = $3, description = $4, group_id = $5, group_pos = (SELECT GREATEST(COUNT(group_pos),MAX(group_pos)+1) FROM Members WHERE group_id = $5), brackets = $6::text[] WHERE user_id = $7 AND name = $8",
						[t.avatar_url || old.avatar_url || "https://i.imgur.com/ZpijZpg.png", t.message_count || 0, t.birthday || null, t.description || null, old.group_id || systemGroup.id, newBrackets, uid, t.name]);
				}
				await client.query('COMMIT');
				let systemGroupTups = await bot.db.groups.memberCount(systemGroup.id);
				if(systemGroupTups == 0) await bot.db.groups.delete(uid,systemGroup.id);
				return `Import successful. Added ${added} entries and updated ${updated} entries.`;
			} catch(e) {
				bot.err(msg,e,false);
				if(client) await client.query('ROLLBACK');
				return `Something went wrong importing your data. This may have resulted in a partial import. Please check the data and try again. (${e.code || e.message})`;
			} finally {
				if(client) client.release();
			}
		} else return "Unknown file format. Please notify the creator by joining the support server.";
	}
};
