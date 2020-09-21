const request = require("got");

module.exports = {
	help: cfg => "Import your data from a file",
	usage: cfg =>  ["import [link] - Attach a compatible .json file or supply a link to a file when using this command. Data files can be obtained from compatible bots like me and Pluralkit."],
	permitted: () => true,
	desc: cfg => "Importing data acts as a merge, meaning if there are any " + cfg.lang + "s already registered with the same name as one being imported, the values will be updated instead of registering a new one.",
	cooldown: msg => 300000,
	tupperbox: async (bot, msg, client, data, oldData) => {

		let added = 0;
		let updated = 0;

		await client.query("BEGIN");

		for await (let g of data.groups) {
			let old = oldData.groups.find(gr => g.name == gr.name) || {};
			if(!old.name) { //update existing entry
				added++;
				await bot.db.groups.add(msg.author.id, g.name, client);
			} else updated++;
			await client.query("UPDATE Groups SET description = $1, tag = $2 WHERE user_id = $3 AND name = $4",
				[g.description || null, g.tag || null, msg.author.id, g.name]);
		}

		for await (let t of data.tuppers) {
			let old = oldData.tuppers.find(tu => t.name == tu.name) || {};

			if(!old.name) { //update existing entry
				added++;
				await bot.db.members.add(msg.author.id,{name: t.name,brackets: t.brackets}, client);
			} else updated++;

			// todo: there *must* be a better way of doing this
			await client.query("UPDATE Members SET avatar_url = $1, posts = $2, show_brackets = $3, birthday = $4, description = $5, tag = $6, brackets = $7 WHERE user_id = $8 AND name = $9",
				[t.avatar_url || old.avatar_url, Math.max(old.posts || 0,t.posts || 0), t.show_brackets || false, t.birthday || null, t.description || null, t.tag || null, t.brackets || old.brackets, msg.author.id, t.name]);

			if(old.group_id != t.group_id) {
				let grp = data.groups.find(g => g.id == t.group_id);
				let validGroup = grp ? (await bot.db.groups.get(msg.author.id,grp.name)) : null;
				if(validGroup)
					await client.query("UPDATE Members SET group_id = $1, group_pos = (SELECT GREATEST(COUNT(group_pos),MAX(group_pos)+1) FROM Members WHERE group_id = $1) WHERE user_id = $2 AND name = $3", [validGroup.id,msg.author.id, t.name]);
			}
		}
		await client.query("COMMIT");
		return `Import successful. Added ${added} entries and updated ${updated} entries.`;
	},
	pluralkit: async (bot, msg, client, data, oldData) => {
		let sysName = data.name || msg.author.username;

		let systemGroup = await bot.db.groups.get(msg.author.id,sysName);
		if(!systemGroup) {
			await bot.db.groups.add(msg.author.id,sysName);
			await bot.db.query("UPDATE Groups SET description = $1, tag = $2 WHERE user_id = $3 AND name = $4",[data.description || null, data.tag || null, msg.author.id, sysName]);
			systemGroup = await bot.db.groups.get(msg.author.id, sysName);
		}

		let added = 0;
		let updated = 0;
		await client.query("BEGIN");

		for await (let t of data.members) {
			let old = oldData.tuppers.find(tu => t.name == tu.name) || {};
			let newBrackets = (t.proxy_tags.length == 0) ? [`${t.name}:`,""] : t.proxy_tags.map(pt => [pt.prefix ||  "", pt.suffix || ""]).reduce((acc,val) => acc.concat(val),[]);

			if(!old.name) { //update existing entry
				added++;
				await bot.db.members.add(msg.author.id,{name:t.name,brackets:newBrackets},client);
			} else updated++;

			await client.query("UPDATE Members SET avatar_url = $1, posts = $2, birthday = $3, description = $4, group_id = $5, group_pos = (SELECT GREATEST(COUNT(group_pos),MAX(group_pos)+1) FROM Members WHERE group_id = $5), brackets = $6::text[] WHERE user_id = $7 AND name = $8",
				[t.avatar_url || old.avatar_url || "https://i.imgur.com/ZpijZpg.png", t.message_count || 0, t.birthday || null, t.description || null, old.group_id || systemGroup.id, newBrackets, msg.author.id, t.name]);
		}
		await client.query("COMMIT");

		if (await bot.db.groups.memberCount(systemGroup.id) == 0) await bot.db.groups.delete(msg.author.id,systemGroup.id);
		return `Import successful. Added ${added} entries and updated ${updated} entries.`;
	},
	execute: async (bot, msg, args, cfg) => {
		let file = msg.attachments[0] ?? args[0];
		if(!file) return "Please attach or link to a .json file to import when running this command.\nYou can get a file by running the export command from me or Pluralkit.";

		let data;
		try {
			data = JSON.parse((await request(msg.attachments[0] ? msg.attachments[0].url : args[0])).body);
		} catch(e) {
			return "Please attach a valid .json file.";
		}

		if (!data.tuppers && !data.switches) return "Unknown file format. Please notify the creator by joining the support server. " + (process.env.SUPPORT_INVITE ? `https://discord.gg/${process.env.SUPPORT_INVITE}` : "");

		if ((data.tuppers && (data.tuppers.length > 3000 || data.groups.length > 500)) || (data.switches && (data.members.length > 3000))) return "Data too large for import. Please visit the support server for assistance. " + (process.env.SUPPORT_INVITE ? `https://discord.gg/${process.env.SUPPORT_INVITE}` : "");

		let confirm = await bot.confirm(msg, "Warning: This will overwrite your data. Only use this command with a recent, untampered .json file generated from the export command from either me or PluralKit. Please reply 'yes' if you wish to continue.");
		if (confirm !== true) return confirm;

		let old = {
			tuppers: await bot.db.members.getAll(msg.author.id),
			groups: await bot.db.groups.getAll(msg.author.id),
		}

		let client = await bot.db.connect();
		try {
			if(data.tuppers) return await module.exports.tupperbox(bot, msg, client, data, old);
			else if(data.switches) return await module.exports.pluralkit(bot, msg, client, data, old);
		} catch(e) {
			bot.err(msg,e,false);
			if(client) await client.query("ROLLBACK");
			return `Something went wrong importing your data. This may have resulted in a partial import. Please check the data and try again. (${e.code || e.message})`;
		} finally {
			if(client) client.release();
		}
	}
};
