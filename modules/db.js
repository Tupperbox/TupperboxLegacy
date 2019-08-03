const { Pool } = require("pg");
const fs = require("fs");

let pool = new Pool();

const question = q => {
	let rl = require("readline").createInterface({input:process.stdin,output:process.stdout});
	return new Promise((res,rej) => {
		rl.question(q, ans => { rl.close(); res(ans); });
	});
};

let updateBlacklist = async (serverID, id, isChannel, blockProxies, blockCommands) => {
	return await pool.query("INSERT INTO Blacklist VALUES ($1,$2,$3,CASE WHEN $4::BOOLEAN IS NULL THEN false ELSE $4::BOOLEAN END,CASE WHEN $5::BOOLEAN IS NULL THEN false ELSE $5::BOOLEAN END) ON CONFLICT (id,server_id) DO UPDATE SET block_proxies = (CASE WHEN $4::BOOLEAN IS NULL THEN Blacklist.block_proxies ELSE EXCLUDED.block_proxies END), block_commands = (CASE WHEN $5::BOOLEAN IS NULL THEN Blacklist.block_commands ELSE EXCLUDED.block_commands END)",[id,serverID,isChannel,blockProxies,blockCommands]);
};

module.exports = {
	init: async () => {
		process.stdout.write("Checking postgres connection... ");
		(await (await pool.connect()).release());
		process.stdout.write("ok!\nChecking tables...");
		//move members after
		await pool.query(`
		  CREATE TABLE IF NOT EXISTS Webhooks(
			id VARCHAR(32) PRIMARY KEY,
			channel_id VARCHAR(32) NOT NULL,
			token VARCHAR(100) NOT NULL
		  );
		  CREATE TABLE IF NOT EXISTS Servers(
			id VARCHAR(32) PRIMARY KEY,
			prefix TEXT NOT NULL,
			lang TEXT NOT NULL,
			lang_plural TEXT,
			log_channel VARCHAR(32)
		  );
		  CREATE TABLE IF NOT EXISTS Blacklist(
			id VARCHAR(32) NOT NULL,
			server_id VARCHAR(32) NOT NULL,
			is_channel BOOLEAN NOT NULL,
			block_proxies BOOLEAN NOT NULL,
			block_commands BOOLEAN NOT NULL,
			PRIMARY KEY (id, server_id)
		  );
		  CREATE TABLE IF NOT EXISTS Groups(
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(32) NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			tag VARCHAR(32),
			position INTEGER,
			UNIQUE (user_id, name)
		  );
		  CREATE TABLE IF NOT EXISTS Members(
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(32) NOT NULL,
			name VARCHAR(32) NOT NULL,
			position INTEGER NOT NULL,
			avatar_url TEXT NOT NULL,
			brackets TEXT[] NOT NULL,
			posts INTEGER NOT NULL,	
			show_brackets BOOLEAN NOT NULL,
			birthday DATE,
			description TEXT,
			tag VARCHAR(32),
			group_id INTEGER,
			group_pos INTEGER,
			UNIQUE (user_id,name),
			FOREIGN KEY (group_id) REFERENCES groups(id)
		  );`);

		console.log("ok!\nChecking for data to import...");
		let found = false;
		//check tulpae.json
		try {
			let tulpae = require("../tulpae.json");
			found = true;
			if((await question("Found tulpae.json file. Import to database? (yes/no)\n") != "yes")) console.log("Ignoring file."); 
			else {
				console.log("Beginning import.");
				let count = 0;
				let keys = Object.keys(tulpae);
				for(let id of keys) {
					count++;
					console.log(`\tImporting user ${id} (${count} of ${keys.length})`);
					for(let i=0;i<tulpae[id].length;i++) {
						let a = count;
						let tulpa = tulpae[id][i];
						let conn = await pool.connect();
						conn.query("INSERT INTO Members(user_id,name,position,avatar_url,brackets,posts,show_brackets,birthday,description,tag) VALUES ($1,$2,$3,$4,$5,$6,$7,to_timestamp($8)::date,$9,$10)",
							[id,tulpa.name,i,tulpa.url,tulpa.brackets,tulpa.posts,!!tulpa.showbrackets,tulpa.birthday ? tulpa.birthday/1000 : null,tulpa.desc || null,tulpa.tag || null])
							.catch(e => { console.error(e); })
							.then(() => {
								console.log(`\tuser ${a} - ${tulpa.name} done`);
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
							if(cfg.blacklist) for(let bl of cfg.blacklist) await updateBlacklist(id,bl,true,true,null).then(() => console.log(`${id} - blacklist updated`));
							if(cfg.cmdblacklist) for(let bl of cfg.cmdblacklist) await updateBlacklist(id,bl,true,null,true).then(() => console.log(`${id} - blacklist updated`));
							conn.release();
						}).catch(e => { throw e; });
				}
				await pool.end();
				pool = new Pool();
				fs.unlink("./servercfg.json", err => { if(err) console.error(err); });
			}
		} catch(e) { if(e.code != "MODULE_NOT_FOUND") console.log(e);}
		if(!found) console.log("Data OK.");
	},

	query: (text, params, callback) => {
		return pool.query(text, params, callback);
	},

	addTulpa: async (userID, name, brackets) => {
		return await pool.query("INSERT INTO Members (user_id, name, position, avatar_url, brackets, posts, show_brackets) VALUES ($1::VARCHAR(32), $2, (SELECT GREATEST(COUNT(position),MAX(position)+1) FROM Members WHERE user_id = $1::VARCHAR(32)), $3, $4, 0, false)", [userID,name,"https://i.imgur.com/ZpijZpg.png",brackets]);
	},

	getTulpa: async (userID, name) => {
		return (await pool.query("SELECT * FROM Members WHERE user_id = $1 AND LOWER(name) = LOWER($2)", [userID, name])).rows[0];
	},

	updateTulpa: async (userID, name, column, newVal) => {
		return await pool.query(`UPDATE Members SET ${column} = $1 WHERE user_id = $2 AND LOWER(name) = LOWER($3)`, [newVal, userID, name]);
	},

	deleteTulpa: async (userID, name) => {
		return await pool.query("DELETE FROM Members WHERE user_id = $1 AND LOWER(name) = LOWER($2)", [userID, name]);
	},

	mergeTulpa: async () => {

	},

	addCfg: async (serverID) => {
		return await pool.query("INSERT INTO Servers(id, prefix, lang) VALUES ($1, $2, $3)", [serverID,"tul!","tupper"]);
	},

	getCfg: async (serverID) => { 
		return (((await pool.query("SELECT * FROM Servers WHERE id = $1", [serverID])).rows[0]) || { id: serverID, prefix: "tul!", lang: "tupper"});
	},

	updateCfg: async (serverID, column, newVal) => {
		await pool.query("INSERT INTO Servers(id, prefix, lang) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;",[serverID, "tul!", "tupper"]);
		return await pool.query(`UPDATE Servers SET ${column} = $1 WHERE id = $2`, [newVal,serverID]);
	},

	deleteCfg: async (serverID) => {
		return await pool.query("DELETE FROM Servers WHERE id = $1", [serverID]);
	},

	getBlacklist: async (serverID) => {
		return (await pool.query("SELECT * FROM Blacklist WHERE server_id = $1", [serverID])).rows;
	},

	updateBlacklist: updateBlacklist,

	deleteBlacklist: async (serverID, id) => {
		return await pool.query("DELETE FROM Blacklist WHERE server_id = $1 AND id = $2", [serverID, id]);
	},

	isBlacklisted: async (serverID, id, proxy) => {
		if(proxy) return (await pool.query("SELECT block_proxies, block_commands FROM Blacklist WHERE server_id = $1 AND id = $2 AND block_proxies = true", [serverID, id])).rows[0];
		else return (await pool.query("SELECT block_proxies, block_commands FROM Blacklist WHERE server_id = $1 AND id = $2 AND block_commands = true", [serverID, id])).rows[0];
	},

	getGroup: async (userID, name) => {
		return (await pool.query("SELECT * FROM Groups WHERE user_id = $1 AND LOWER(name) = LOWER($2)", [userID, name])).rows[0];
	},

	getGroups: async(userID) => {
		return (await pool.query("SELECT * FROM Groups WHERE user_id = $1", [userID])).rows;
	},

	addGroup: async (userID, name) => {
		return await pool.query("INSERT INTO Groups (user_id, name, position) VALUES ($1::VARCHAR(32), $2, (SELECT GREATEST(COUNT(position),MAX(position)+1) FROM Groups WHERE user_id = $1::VARCHAR(32)))", [userID, name]);
	},

	updateGroup: async (userID, name, column, newVal) => {
		return await pool.query(`UPDATE Groups SET ${column} = $1 WHERE user_id = $2 AND LOWER(name) = LOWER($3)`, [newVal, userID, name]);
	},

	deleteGroup: async (userID, name) => {
		return await pool.query("DELETE FROM Groups WHERE user_id = $1 AND LOWER(name) = LOWER($2)", [userID, name]);
	},

	end: async () => { return await pool.end(); }
};