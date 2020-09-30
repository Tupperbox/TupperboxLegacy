const { Pool } = require("pg");
const fs = require("fs");
const cache = require("./redis");

let pool = new Pool();

const question = q => {
	let rl = require("readline").createInterface({input:process.stdin,output:process.stdout});
	return new Promise((res,rej) => {
		rl.question(q, ans => { rl.close(); res(ans); });
	});
};

const blacklistBitfield = (blockProxies, blockCommands) => {
	let blacklist = 0;
	if (blockCommands) blacklist |= 1;
	if (blockProxies) blacklist |= 2;
	return blacklist;
};

module.exports = {

	init: async () => {
		process.stdout.write("Checking postgres connection... ");
		(await (await pool.connect()).release());
		process.stdout.write("ok!\nChecking tables...");
		//move members after
		await pool.query(`
		create or replace function create_constraint_if_not_exists (
			t_name text, c_name text, constraint_sql text
		) 
		returns void AS
		$$
		begin
			-- Look for our constraint
			if not exists (select constraint_name 
							from information_schema.constraint_column_usage 
							where table_name = t_name  and constraint_name = c_name) then
				execute constraint_sql;
			end if;
		end;
		$$ language 'plpgsql';

		CREATE TABLE IF NOT EXISTS webhooks(
			id VARCHAR(32) PRIMARY KEY,
			channel_id VARCHAR(32) NOT NULL,
			token VARCHAR(100) NOT NULL
		);
		CREATE TABLE IF NOT EXISTS servers(
			id VARCHAR(32) PRIMARY KEY,
			prefix TEXT NOT NULL,
			lang TEXT NOT NULL,
			lang_plural TEXT,
			log_channel VARCHAR(32)
		);
		CREATE TABLE IF NOT EXISTS blacklist(
			id VARCHAR(32) NOT NULL,
			server_id VARCHAR(32) NOT NULL,
			is_channel BOOLEAN NOT NULL,
			block_proxies BOOLEAN NOT NULL,
			block_commands BOOLEAN NOT NULL,
			PRIMARY KEY (id, server_id)
		);
		CREATE TABLE IF NOT EXISTS groups(
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(32) NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			tag VARCHAR(32)
		);
		CREATE TABLE IF NOT EXISTS members(
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(32) NOT NULL,
			name VARCHAR(80) NOT NULL,
			position INTEGER NOT NULL,
			avatar_url TEXT NOT NULL,
			brackets TEXT[] NOT NULL,
			posts INTEGER NOT NULL,	
			show_brackets BOOLEAN NOT NULL,
			birthday DATE,
			description TEXT,
			tag VARCHAR(32),
			group_id INTEGER,
			UNIQUE (user_id,name)
		);
		CREATE TABLE IF NOT EXISTS global_blacklist(
			user_id VARCHAR(50) PRIMARY KEY
		);

		ALTER TABLE groups
			ADD COLUMN IF NOT EXISTS position INTEGER;
		ALTER TABLE members
			ADD COLUMN IF NOT EXISTS group_pos INTEGER;

		SELECT create_constraint_if_not_exists('groups','groups_user_id_name_key',
			'ALTER TABLE groups ADD CONSTRAINT groups_user_id_name_key UNIQUE (user_id, name);'
		);
		SELECT create_constraint_if_not_exists('groups','members_group_id_fkey',
			'ALTER TABLE members ADD CONSTRAINT members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id);'
		);`);

		await pool.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS members_lower_idx ON members(lower(name))");
		await pool.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS webhooks_channelidx ON webhooks(channel_id);");

		console.log("ok!\nChecking for data to import...");
		let found = false;
		//check tulpae.json
		try {
			let members = require("../tulpae.json");
			found = true;
			if((await question("Found tulpae.json file. Import to database? (yes/no)\n") != "yes")) console.log("Ignoring file."); 
			else {
				console.log("Beginning import.");
				let count = 0;
				let keys = Object.keys(members);
				for(let id of keys) {
					count++;
					console.log(`\tImporting user ${id} (${count} of ${keys.length})`);
					for(let i=0;i<members[id].length;i++) {
						let a = count;
						let member = members[id][i];
						let conn = await pool.connect();
						conn.query("INSERT INTO Members(user_id,name,position,avatar_url,brackets,posts,show_brackets,birthday,description,tag) VALUES ($1,$2,$3,$4,$5,$6,$7,to_timestamp($8)::date,$9,$10)",
							[id,member.name,i,member.url,member.brackets,member.posts,!!member.showbrackets,member.birthday ? member.birthday/1000 : null,member.desc || null,member.tag || null])
							.catch(e => { console.error(e); })
							.then(() => {
								console.log(`\tuser ${a} - ${member.name} done`);
								conn.release();
							});
					}
				}
				await pool.end();
				pool = new Pool();
				fs.unlink("./tulpae.json", err => { if(err) console.error(err); });
			}
		} catch(e) { if(e.code != "MODULE_NOT_FOUND") console.log(e);}
		//check webhooks.json
		try {
			let webhooks = require("../webhooks.json");
			found = true;
			if((await question("Found webhooks.json file. Import to database? (yes/no)\n") != "yes")) console.log("Ignoring file."); 
			else {
				console.log("Beginning import.");
				let count = 0;
				let keys = Object.keys(webhooks);
				for(let id of keys) {
					count++;
					console.log(`\tImporting webhook for channel ${id} (${count} of ${keys.length})`);
					let conn = await pool.connect();
					conn.query("INSERT INTO Webhooks VALUES ($1,$2,$3)", [webhooks[id].id,id,webhooks[id].token])
						.catch(e => { console.error(e); })
						.then(() => {
							console.log(`\twebhook ${id} done`);
							conn.release();
						});
				}
				await pool.end();
				pool = new Pool();
				fs.unlink("./webhooks.json", err => { if(err) console.error(err); });
			}
		} catch(e) { if(e.code != "MODULE_NOT_FOUND") console.log(e);}
		//check servercfg.json
		try {
			let config = require("../servercfg.json");
			found = true;
			if((await question("Found servercfg.json file. Import to database? (yes/no)\n") != "yes")) console.log("Ignoring file."); 
			else {
				console.log("Beginning import.");
				let count = 0;
				let keys = Object.keys(config);
				for(let id of keys) {
					count++;
					let cfg = config[id];
					console.log(`\tImporting config for server ${id} (${count} of ${keys.length})`);
					let conn = await pool.connect();
					conn.query("INSERT INTO Servers VALUES ($1,$2,$3,$4,$5)", [id,cfg.prefix,cfg.lang,null,cfg.log || null])
						.catch(e => { console.error(e); })
						.then(async () => {
							if(cfg.blacklist) for(let bl of cfg.blacklist) await module.exports.blacklist.update(id,bl,true,true,null).then(() => console.log(`${id} - blacklist updated`));
							if(cfg.cmdblacklist) for(let bl of cfg.cmdblacklist) await module.exports.blacklist.update(id,bl,true,null,true).then(() => console.log(`${id} - blacklist updated`));
							conn.release();
						}).catch(e => { throw e; });
				}
				await pool.end();
				pool = new Pool();
				fs.unlink("./servercfg.json", err => { if(err) console.error(err); });
			}
		} catch(e) { if(e.code != "MODULE_NOT_FOUND") console.log(e);}
		if(!found) console.log("Data OK.");
		process.stdout.write("Checking Redis connection...");
		await cache.redis.set("test", 1);
		if(await cache.redis.get("test") != 1) throw new Error("Cache integrity check failed");
		await cache.redis.del("test");
		await cache.redis.flushall();
		console.log("ok!");
	},

	connect: () => pool.connect(),
	end: async () => { return await pool.end(); },

	query: (text, params, callback) => {
		return pool.query(text, params, callback);
	},

	members: {
		add: async (userID, member, client) => 
			await (client || module.exports).query("insert into Members (user_id, name, position, avatar_url, brackets, posts, show_brackets) values ($1::VARCHAR(32), $2, (select greatest(count(position), max(position)+1) from Members where user_id = $1::VARCHAR(32)), $3, $4, 0, false)", [userID, member.name, member.avatarURL || "https://i.imgur.com/ZpijZpg.png",member.brackets]),

		get: async (userID, name) =>
			(await module.exports.query("select * from Members where user_id = $1 and lower(name) = lower($2)", [userID, name])).rows[0],

		getAll: async (userID) =>
			(await module.exports.query("select * from Members where user_id = $1 order by group_pos, position", [userID])).rows,

		count: async () => 
			(await module.exports.query("SELECT COUNT(*) FROM Members")).rows[0].count,

		export: async (userID, name) =>
			(await module.exports.query("select name, avatar_url, brackets, posts, show_brackets, birthday, description, tag, group_id, group_pos from Members where user_id = $1 and lower(name) = lower($2)", [userID, name])).rows[0],

		update: async (userID, name, column, newVal) =>
			await module.exports.query(`update Members set ${column} = $1 where user_id = $2 and lower(name) = lower($3)`, [newVal, userID, name]),

		removeGroup: async (memberID) =>
			await module.exports.query("update Members set group_id = null, group_pos = null where id = $1", [memberID]),

		removeAllGroups: async (userID) =>
			await module.exports.query("update Members set group_id = null, group_pos = null where user_id = $1", [userID]),

		removeAllTags: async (userID) =>
			await module.exports.query("update Members set tag = null where user_id = $1", [userID]),

		delete: async (userID, name) =>
			await module.exports.query("delete from Members where user_id = $1 and lower(name) = lower($2)", [userID, name]),

		clearTags: async (userID) =>
			await module.exports.query("update Members set tag = null where user_id = $1", [userID]),

		clear: async (userID) =>
			await module.exports.query("delete from Members where user_id = $1", [userID]),
	},

	groups: {
		get: async (userID, name) => {
			return (await pool.query("SELECT * FROM Groups WHERE user_id = $1 AND LOWER(name) = LOWER($2)", [userID, name])).rows[0];
		},

		getById: async (id) => {
			return (await pool.query("select * from Groups where id = $1", [id])).rows[0];
		},

		getAll: async (userID) => {
			return (await pool.query("SELECT * FROM Groups WHERE user_id = $1 ORDER BY position", [userID])).rows;
		},

		memberCount: async (groupID) =>
			(await module.exports.query("select count(name) from Members where group_id = $1", [groupID])).rows[0].count,

		add: async (userID, name, client) => {
			return await (client || pool).query("INSERT INTO Groups (user_id, name, position) VALUES ($1::VARCHAR(32), $2, (SELECT GREATEST(COUNT(position),MAX(position)+1) FROM Groups WHERE user_id = $1::VARCHAR(32)))", [userID, name]);
		},

		addMember: async (groupID, memberID) =>
			await module.exports.query("UPDATE Members SET group_id = $1, group_pos = (SELECT GREATEST(COUNT(group_pos),MAX(group_pos)+1) FROM Members WHERE group_id = $1) WHERE id = $2", [groupID,memberID]),

		update: async (userID, name, column, newVal) => {
			return await pool.query(`UPDATE Groups SET ${column} = $1 WHERE user_id = $2 AND LOWER(name) = LOWER($3)`, [newVal, userID, name]);
		},

		removeMembers: async (id) =>
			await pool.query("update Members set group_id = null, group_pos = null where group_id = $1", [id]),

		delete: async (id) => {
			await module.exports.groups.removeMembers(id);
			await pool.query("DELETE FROM Groups WHERE id = $1", [id]);			
		},

		deleteAll: async (userID) => {
			await pool.query("UPDATE Members SET group_id = null, group_pos = null WHERE user_id = $1", [userID]);
			await pool.query("DELETE FROM Groups WHERE user_id = $1", [userID]);
		},
	},

	config: {
		add: async (serverID, cfg) => {
			return await pool.query("INSERT INTO Servers(id, prefix, lang) VALUES ($1, $2, $3)", [serverID,cfg.prefix,cfg.lang]);
		},

		get: async (serverID) => {
			let cfg = await cache.config.get(serverID);
			if(cfg) return cfg;
			cfg = ((await pool.query("SELECT prefix, lang, lang_plural, log_channel FROM Servers WHERE id = $1", [serverID])).rows[0]);
			if(cfg) cache.config.set(serverID, cfg);
			return cfg;
		},

		update: async (serverID, column, newVal, cfg) => {
			await pool.query("INSERT INTO Servers(id, prefix, lang) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;",[serverID,cfg.prefix,cfg.lang]);
			let updated = (await pool.query(`UPDATE Servers SET ${column} = $1 WHERE id = $2 RETURNING prefix, lang, lang_plural, log_channel`, [newVal,serverID])).rows[0];
			if(updated) return await cache.config.set(serverID, updated);
		},

		delete: async (serverID) => {
			cache.config.delete(serverID);
			return await pool.query("DELETE FROM Servers WHERE id = $1", [serverID]);
		},
	},	

	blacklist: {
		get: async (channel) => {
			if (!channel.guild) return 2; // DM channel: commands OK, proxy NO
			let blacklistCache = await cache.blacklist.get(channel.id);
			if (blacklistCache) return blacklistCache;

			let blacklist;

			let dbBlacklist = (await module.exports.query("select * from blacklist where server_id = $1 and id = $2", [channel.guild.id, channel.id])).rows;
			if (dbBlacklist.length == 0) blacklist = 0;
			
			blacklist = blacklistBitfield(dbBlacklist.filter(x => x.block_proxies).length > 0, dbBlacklist.filter(x => x.block_commands).length > 0);
			cache.blacklist.set(channel.id, blacklist);
			return blacklist;
		},

		getAll: async (serverID) => {
			return (await pool.query("SELECT * FROM Blacklist WHERE server_id = $1", [serverID])).rows;
		},

		update: async (serverID, id, isChannel, blockProxies, blockCommands) => {
			cache.blacklist.set(id, blacklistBitfield(blockProxies, blockCommands));
			return await pool.query("INSERT INTO Blacklist VALUES ($1,$2,$3,CASE WHEN $4::BOOLEAN IS NULL THEN false ELSE $4::BOOLEAN END,CASE WHEN $5::BOOLEAN IS NULL THEN false ELSE $5::BOOLEAN END) ON CONFLICT (id,server_id) DO UPDATE SET block_proxies = (CASE WHEN $4::BOOLEAN IS NULL THEN Blacklist.block_proxies ELSE EXCLUDED.block_proxies END), block_commands = (CASE WHEN $5::BOOLEAN IS NULL THEN Blacklist.block_commands ELSE EXCLUDED.block_commands END)",[id,serverID,isChannel,blockProxies,blockCommands]);
		},

		delete: async (guildID, channelID) => {
			cache.blacklist.delete(channelID);
			return await module.exports.query("delete from Blacklist where server_id = $1 and id = $2", [guildID, channelID]);	
		},

	},

	webhooks: {
		get: async (channelID) =>
			(await module.exports.query("select * from Webhooks where channel_id = $1", [channelID])).rows[0],

		set: async (hook) =>
			await module.exports.query("insert into Webhooks values ($1, $2, $3)", [hook.id, hook.channel_id, hook.token]),

		delete: async (channelID) =>
			await module.exports.query("delete from Webhooks where channel_id = $1", [channelID]),
	},

	getGlobalBlacklisted: async (id) => {
		return (await pool.query("SELECT * FROM global_blacklist WHERE user_id = $1", [id])).rows[0];
	},

};
