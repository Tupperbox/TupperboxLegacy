const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change your groups",
	usage: cfg =>  ["group create <name> - Add a new group with the given name",
		"group delete <name> - Remove a group, all " + cfg.lang + "s in the group will be reassigned to empty group",
		"group add <name> <member> - Add an existing " + cfg.lang + " to the named group (use * to select all groupless " + cfg.lang + "s)",
		"group remove <name> <member> - Remove a member from the named group (use * to empty the group)",
		"group list - Short list of your groups and their " + cfg.lang + "s",
		"group rename <name> <newname> - Rename a group",
		"group tag <name> <tag> - Give the group a tag, to be displayed after group member names and personal tags",
		"group describe <name> <description> - Give the group a description"],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg, members) => {
		let name,existing,group,tup;
		switch(args[0]) {
		case "create":
			if(!args[1]) return "No group name given.";
			name = args.slice(1).join(" ");
			existing = await bot.db.groups.get(msg.author.id, name);
			if(existing) return "You already have a group with that name.";
			await bot.db.groups.add(msg.author.id, bot.noVariation(name));
			return `Group created. Add ${cfg.lang}s to it with "${cfg.prefix}group add ${args.length < 3 ? name : "'" + name + "'"} <name> [name...]".`;

		case "delete":
			if(!args[1]) return "No group name given.";
			if(args[1] == "*") {
				await bot.db.groups.deleteAll(msg.author.id);
				return "All groups deleted and members set to no group.";
			}
			name = args.slice(1).join(" ");
			existing = await bot.db.groups.get(msg.author.id, name);
			if(!existing) return "You don't have a group with that name.";
			await bot.db.groups.delete(existing.id);
			return "Group deleted, members have been set to no group.";

		case "add":
			if(!args[1]) return "No group name given.";
			if(!args[2]) return `No ${cfg.lang} name given.`;
			group = await bot.db.groups.get(msg.author.id, args[1]);
			if(!group) return "You don't have a group with that name.";
			args = args.slice(2);

			if (args.length == 1) {
				if (args[0] == "*") {
					for (tup of members.filter(t => t.group_id == null)) {
						await bot.db.groups.addMember(group.id,tup.id);
					} 
					return `All groupless ${cfg.lang}s assigned to group ${group.name}.`;
				}

				tup = await bot.db.members.get(msg.author.id, args[0]);
				if(!tup) return `You don't have a registered ${cfg.lang} with that name.`;
				await bot.db.groups.addMember(group.id,tup.id);
				return `${proper(cfg.lang)} '${tup.name}' group set to '${group.name}'.`;
			}

			let addedMessage = `${proper(cfg.lang)}s added to group:`;
			let notAddedMessage = `${proper(cfg.lang)}s not found:`;
			let baseLength = 2000 - (addedMessage.length + notAddedMessage.length);
			let originalLength = { addedMessage: addedMessage.length, notAddedMessage: notAddedMessage.length, };

			for (let arg of args) {
				let tup = await bot.db.members.get(msg.author.id, arg);
				if (tup) {
					await bot.db.groups.addMember(group.id,tup.id);
					if ((addedMessage.length + notAddedMessage.length + arg.length) < baseLength) addedMessage += ` '${arg}'`; else addedMessage += " (...)";
				} else {
					if ((addedMessage.length + notAddedMessage.length + arg.length) < baseLength) notAddedMessage += ` '${arg}'`; else notAddedMessage += " (...)";
				}
			}
			if (addedMessage.length == originalLength.addedMessage) return `No ${cfg.lang}s added to group.`;
			if (notAddedMessage.length == originalLength.notAddedMessage) return addedMessage;
			return `${addedMessage}\n${notAddedMessage}`;

		case "remove":
			if(!args[1]) return "No group name given.";
			if(!args[2]) return `No ${cfg.lang} name given.`;
			group = await bot.db.groups.get(msg.author.id, args[1]);
			if(!group) return "You don't have a group with that name.";
			args = args.slice(2);

			if (args.length == 1) {
				if (args[0] == "*") {
					await bot.db.members.removeAllGroups(msg.author.id);
					return `All ${cfg.lang}s set to no group.`;
				}
				tup = await bot.db.members.get(msg.author.id, args[0]);
				if(!tup) return "You don't have a registered " + cfg.lang + " with that name.";
				await bot.db.members.removeGroup(tup.id);
				return `${proper(cfg.lang)} '${tup.name}' group unset.`;
			}

			let removedMessage = `${proper(cfg.lang)}s removed from group:`;
			let notRemovedMessage = `${proper(cfg.lang)}s not found:`;
			let rBaseLength = 2000 - (removedMessage.length + notRemovedMessage.length);
			let rOriginalLength = { removedMessage: removedMessage.length, notRemovedMessage: notRemovedMessage.length, };

			for (let arg of args) {
				tup = await bot.db.members.get(msg.author.id, arg);
				if (tup) {
					await bot.db.members.removeGroup(tup.id);
					if ((removedMessage.length + notRemovedMessage.length + arg.length) < rBaseLength) removedMessage += ` '${arg}'`; else removedMessage += " (...)";
				} else {
					if ((removedMessage.length + notRemovedMessage.length + arg.length) < rBaseLength) notRemovedMessage += ` '${arg}'`; else notRemovedMessage += " (...)";
				}
			}
			if (removedMessage.length == rOriginalLength.removedMessage) return `No ${cfg.lang}s found that could be removed from this group.`;
			if (notRemovedMessage.length == rOriginalLength.notRemovedMessage) return removedMessage;
			return `${removedMessage}\n${notRemovedMessage}`;

		case "list":
			let groups = await bot.db.groups.getAll(msg.author.id);
			if(!groups[0]) return `You have no groups. Try \`${cfg.prefix}group create <name>\` to make one.`;
			let extra = {
				title: `${msg.author.username}#${msg.author.discriminator}'s registered groups`,
				author: {
					name: msg.author.username,
					icon_url: msg.author.avatarURL
				}
			};
			if(members.find(t => !t.group_id))
				groups.push({name: "No Group", id: null});
			let embeds = await bot.paginator.generatePages(bot, groups,g => {
				let mms = members.filter(t => t.group_id == g.id).map(t => t.name).join(", ");
				let field = {
					name: g.name,
					value: `${g.tag ? "Tag: " + g.tag + "\n" : ""}${g.description ? "Description: " + g.description + "\n" : ""} ${mms ? `Members: ${mms}` : "No members."}`
				};
				if(field.value.length > 1020) field.value = field.value.slice(0,1020) + "...";
				return field;
			},extra);
                
			if(embeds[1]) return bot.paginator.paginate(bot, msg, embeds);                
			return embeds[0];

		case "tag":
			if(!args[1]) return "No group name given.";
			group = await bot.db.groups.get(msg.author.id, args[1]);
			if(!group) return "You don't have a group with that name.";
			if(!args[2]) return group.tag ? "Current tag: " + group.tag + "\nTo remove it, try " + cfg.prefix + "group tag " + group.name + " clear" : "No tag currently set.";
			if(["clear","remove","none","delete"].includes(args[2])) {
				await bot.db.groups.update(msg.author.id,group.name,"tag",null);
				return "Tag cleared.";
			}
			let tag = args.slice(2).join(" ").trim();
			if(tag.length > 25) return "That tag is far too long. Please pick one shorter than 25 characters.";
			await bot.db.groups.update(msg.author.id, group.name, "tag", bot.noVariation(args.slice(2).join(" ")));
			return "Tag set. Group members will attempt to have their group tags displayed when proxying, if there's enough room.";

		case "rename":
			if(!args[1]) return "No group name given.";
			group = await bot.db.groups.get(msg.author.id, args[1]);
			if(!group) return "You don't have a group with that name.";
			if(!args[2]) return "No new name given.";
			let newname = args.slice(2).join(" ").trim();
			let group2 = await bot.db.groups.get(msg.author.id, newname);
			if(group2) return "There is already a group with that name.";
			await bot.db.groups.update(msg.author.id, group.name, "name", bot.noVariation(newname));
			return "Group renamed to '" + newname + "'.";

		case "describe":
			if(!args[1]) return "No group name given.";
			group = await bot.db.groups.get(msg.author.id, args[1]);
			if(!group) return "You don't have a group with that name.";
			if(!args[2]) return group.description ? "Current description: " + group.description + "\nTo remove it, try " + cfg.prefix + "group describe " + group.name + " clear" : "No description currently set.";
			if(["clear","remove","none","delete"].includes(args[2])) {
				await bot.db.groups.update(msg.author.id,group.name,"description",null);
				return "Description cleared.";
			}
			let description = args.slice(2).join(" ").trim();
			await bot.db.groups.update(msg.author.id, group.name, "description", description.slice(0,2000));
			if(description.length > 2000) return "Description updated, but was cut to 2000 characters to fit within Discord embed limits.";
			return "Description updated.";

		default:
			return bot.cmds.help.execute(bot, msg, ["group"], cfg);
		}
	}
};
