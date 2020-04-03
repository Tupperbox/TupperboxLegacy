const validUrl = require("valid-url");
const request = require("got");
const probe = require("probe-image-size");
const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s avatar",
	usage: cfg =>  ["avatar <name> [url] - if url is specified or an image is uploaded with the command, change the " + cfg.lang + "'s avatar, if no image is given, send the current one"],
	permitted: () => true,
	desc: cfg => "It's possible to simply upload the new avatar as an attachment while running the command instead of providing the URL. If a URL is provided, it must be a direct link to an image - that is, the URL should end in .jpg or .png or another common image filetype.\n\nDue to Discord limitations, avatars can't be over 1mb in size and either the width or height of the avatar must be less than 1024.",
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["avatar"], cfg);

		//check arguments
		let name = msg.attachments[0] ? args.join(" ") : args[0];
		let member = await bot.db.getMember(msg.author.id, name);
		if(!member) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(!args[1] && !msg.attachments[0]) return member.avatar_url;
		if(!validUrl.isWebUri(args[1]) && !msg.attachments[0]) return "Malformed url.";

		//check image is valid
		let url = msg.attachments[0] ? msg.attachments[0].url : args[1];
		let head;
		try { head = await request.head(url); }
		catch(e) { return "I was unable to access that URL. Please try another."; }
		if(!head.headers["content-type"] || !head.headers["content-type"].startsWith("image")) return "I couldn't find an image at that URL. Make sure it's a direct link (ends in .jpg or .png for example).";
		if(Number(head.headers["content-length"]) > 1048575) {
			return "That image is too large and Discord will not accept it. Please use an image under 1mb.";
		}
		let res;
		try { res = await probe(url); }
		catch(e) { return "There was a problem checking that image. Please try another."; }
		if(Math.min(res.width,res.height) >= 1024) return "That image is too large and Discord will not accept it. Please use an image where width or height is less than 1024 pixels.";

		//update member
		await bot.db.updateMember(msg.author.id,name,"avatar_url",url);
		return "Avatar changed successfully." + (msg.attachments[0] ? "\nNote: if the message you just used to upload the avatar with gets deleted, the avatar will eventually no longer appear." : "");
	}
};