
module.exports = async (bot,msg,edit) => {

    if(msg.author.bot || msg.type != 0) return;
    if(msg.channel.guild && bot.blacklist.includes(msg.channel.guild.id)) return;
    if(await bot.db.getGlobalBlacklisted(msg.author.id)) return;

    let blacklist = +(await bot.db.blacklist.get(msg.channel));
    let cfg = msg.channel.guild ? (await bot.db.config.get(msg.channel.guild.id) ?? { ...bot.defaultCfg }) : { ...bot.defaultCfg };
    let members = await bot.db.members.getAll(msg.author.id);

    let permissions;
    let dmChannel;

    if (msg.guild) {
        permissions = msg.channel.permissionsOf(bot.user.id);
        if(!permissions.has("readMessages")) return;
        if (!permissions.has("sendMessages")) {
            try { dmChannel = await bot.getDMChannel(msg.author.id); } 
            catch(e) { if(e.code != 50007) bot.err(msg,e,false); return; }
        }
    }

    let dialogKey = msg.channel.id + msg.author.id;

    if (bot.dialogs[dialogKey]) {
        bot.dialogs[dialogKey](msg);
        delete bot.dialogs[dialogKey];
        return;
    }

    if (msg.content == `<@${bot.user.id}>` || msg.content == `<@!${bot.user.id}>`)
    return bot.send(msg.channel,
        `Hello! ${msg.channel.guild ? "This server's" : "My"} prefix is \`${cfg.prefix}\`. Try \`${cfg.prefix}help\` for help${msg.channel.guild ? ` or \`${cfg.prefix}cfg prefix ${process.env.DEFAULT_PREFIX}\` to reset the prefix.` : "."}`
    );

    if (msg.content.startsWith(cfg.prefix)) {
        if (!edit && (!(blacklist & 1) || msg.member.permission.has("manageGuild"))) await bot.cmd({ msg, bot, members, cfg, dmChannel});
        return;
    }

    if (members[0] && !(blacklist & 2) && msg.channel.guild && !dmChannel) bot.proxy.executeProxy({ msg, bot, members, cfg });

}
