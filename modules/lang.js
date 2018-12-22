const vowels = ["a","e","i","o","u"];

module.exports = {
	proper: text => {
		return text.substring(0,1).toUpperCase() + text.substring(1);
	},
	article: cfg => {
		return vowels.includes(cfg.lang.slice(0,1)) ? "an" : "a";
	}
};