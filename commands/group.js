const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change your groups",
    usage: cfg =>  ["group create <name> - Add a new group with the given name",
                    "group delete <name> - Remove a group, all " + cfg.lang + "s in the group will be reassigned to empty group",
                    "group add <name> <member> - Add an existing " + cfg.lang + " to the named group",
                    "group remove <name> <member> - Remove a member from the named group",
                    "group list - Short list of your groups and their " + cfg.lang + "s",
                    "group tag <name> <tag> - Give the group a tag, to be displayed after group member names and personal tags",
                    "group describe <name> <description> - Give the group a description"],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
        let name,existing,group,tup;
        switch(args[0]) {
            case "create":
                if(!args[1]) return "No group name given.";
                name = args.slice(1).join(" ");
                existing = await bot.db.getGroup(msg.author.id, name);
                if(existing) return "You already have a group with that name.";
                await bot.db.addGroup(msg.author.id, name);
                return `Group created. Add ${cfg.lang}s to it with '${cfg.prefix}group add ${name} <name>'.`;

            case "delete":
                if(!args[1]) return "No group name given.";
                name = args.slice(1).join(" ");
                existing = await bot.db.getGroup(msg.author.id, name);
                if(!existing) return "You don't have a group with that name.";
                await bot.db.query('UPDATE Members SET group_id = null WHERE group_id = $1', [existing.id]);
                await bot.db.deleteGroup(msg.author.id, name);
                return "Group deleted, members have been set to no group.";

            case "add":
                if(!args[1]) return "No group name given.";
                if(!args[2]) return `No ${cfg.lang} name given.`;
                group = await bot.db.getGroup(msg.author.id, args[1]);
                if(!group) return "You don't have a group with that name.";
                tup = await bot.db.getTulpa(msg.author.id, args.slice(2).join(" "));
                if(!tup) return "You don't have a registered " + cfg.lang + " with that name.";
                await bot.db.updateTulpa(msg.author.id, tup.name, 'group_id', group.id);
                return `${proper(cfg.lang)} '${tup.name}' group set to '${group.name}'.`;

            case "remove":
                if(!args[1]) return "No group name given.";
                if(!args[2]) return `No ${cfg.lang} name given.`;
                group = await bot.db.getGroup(msg.author.id, args[1]);
                if(!group) return "You don't have a group with that name.";
                tup = await bot.db.getTulpa(msg.author.id, args.slice(2).join(" "));
                if(!tup) return "You don't have a registered " + cfg.lang + " with that name.";
                await bot.db.updateTulpa(msg.author.id, tup.name, 'group_id', null);
                return `${proper(cfg.lang)} '${tup.name}' group unset.`;

            case "list":
                let groups = (await bot.db.query('SELECT * FROM Groups WHERE user_id = $1 ORDER BY position', [msg.author.id])).rows;
                if(!groups[0]) return `You have no groups. Try \`${cfg.prefix}group create <name>\` to make one.`;
                let tulpas = (await bot.db.query('SELECT * FROM Members WHERE user_id = $1', [msg.author.id])).rows;
                let title = `${msg.author.username}#${msg.author.discriminator}'s registered groups`;
                let author = {
                    name: msg.author.username,
                    icon_url: msg.author.avatarURL
                };
                groups.push({name: "No Group", id: null});
                let embeds = bot.generatePages(title,author,groups,g => {
                    return {
                        name: g.name,
                        value: `${g.tag ? "Tag: " + g.tag + "\n" : ""}${g.description ? "Description: " + g.description + "\n" : ""}Members: ${tulpas.filter(t => t.group_id == g.id).map(t => t.name).join(", ")}`
                    };
                });
                
                if(embeds[1]) return bot.paginate(msg, embeds);                
                return embeds[0];

            case "tag":
                if(!args[1]) return "No group name given.";
                group = await bot.db.getGroup(msg.author.id, args[1]);
                if(!group) return "You don't have a group with that name.";
                if(!args[2]) {
                    await bot.db.updateGroup(msg.author.id,group.name,'tag',null);
                    return "Tag cleared.";
                }
                let tag = args.slice(2).join(" ").trim();
                if(tag.length > 25) return "That tag is far too long. Please pick one shorter than 25 characters.";
                await bot.db.updateGroup(msg.author.id, group.name, 'tag', args.slice(2).join(" "));
                return "Tag set. Group members will attempt to have their group tags displayed when proxying, if there's enough room.";

            case "describe":
                if(!args[1]) return "No group name given.";
                group = await bot.db.getGroup(msg.author.id, args[1]);
                if(!group) return "You don't have a group with that name.";
                if(!args[2]) {
                    await bot.db.updateGroup(msg.author.id,group.name,'description',null);
                    return "Description cleared.";
                }
                let description = args.slice(2).join(" ").trim();
                await bot.db.updateGroup(msg.author.id, group.name, 'description', description.slice(0,2000));
                if(description.length > 2000) return "Description updated, but was cut to 2000 characters to fit within Discord embed limits.";
                return "Description updated.";

            default:
                return bot.cmds.help.execute(bot, msg, ["group"], cfg);
        }
	}
};