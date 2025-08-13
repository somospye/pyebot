interface IFilter {
	filter: RegExp;
	mute: boolean;
	warnMessage?: string;
}

const LINK_SOSPECHOSO = "🚫 Enlace sospechoso.";
const SPAM_BOT = "🚫 Spam bot.";

export const spamFilterList: IFilter[] = [
	{ filter: /https?:\/\/[\w.-]+\.xyz($|\W)/i, mute: false, warnMessage: LINK_SOSPECHOSO },
	{ filter: /https?:\/\/[\w.-]+\.click($|\W)/i, mute: false, warnMessage: LINK_SOSPECHOSO },
	{ filter: /https?:\/\/[\w.-]+\.info($|\W)/i, mute: false, warnMessage: LINK_SOSPECHOSO },
	{ filter: /https?:\/\/[\w.-]+\.ru($|\W)/i, mute: false, warnMessage: LINK_SOSPECHOSO },
	{ filter: /https?:\/\/[\w.-]+\.biz($|\W)/i, mute: false, warnMessage: LINK_SOSPECHOSO },
	{ filter: /https?:\/\/[\w.-]+\.online($|\W)/i, mute: false, warnMessage: LINK_SOSPECHOSO },
	{ filter: /https?:\/\/[\w.-]+\.club($|\W)/i, mute: false, warnMessage: LINK_SOSPECHOSO },
	{ filter: /(https?:\/\/)?(t\.me|telegram\.me|wa\.me|whatsapp\.me)\/.+/i, mute: true },
	{ filter: /(https?:\/\/)?(pornhub|xvideos|xhamster|xnxx|hentaila)(\.\S+)+\//i, mute: true },
	{
		filter: /(?!(https?:\/\/)?discord\.gg\/programacion$)(https?:\/\/)?discord\.gg\/\w+/i,
		mute: false,
	},
	{
		filter: /(?!(https?:\/\/)?discord\.com\/invite\/programacion$)(https?:\/\/)?discord\.com\/invite\/.+/i,
		mute: true,
	},
	{
		filter: /(https?:\/\/)?multiigims.netlify.app/i,
		mute: true,
	},
	{ filter: /\[.*?steamcommunity\.com\/.*\]/i, mute: true },
	{ filter: /https?:\/\/(www\.)?\w*solara\w*\.\w+\/?/i, mute: true, warnMessage: SPAM_BOT },
	{
		filter: /(?:solara|wix)(?=.*\broblox\b)(?=.*(?:executor|free)).*/is,
		mute: true,
		warnMessage: SPAM_BOT,
	},
	{
		filter: /(?:https?:\/\/(?:www\.)?|www\.)?outlier\.ai\b/gi,
		mute: true,
		warnMessage: SPAM_BOT,
	},
	{
		filter: /(?=.*\b(eth|ethereum|btc|bitcoin|capital|crypto|memecoins|nitro|\$|nsfw)\b)(?=.*\b(gana\w*|gratis|multiplica\w*|inver\w*|giveaway|server|free|earn)\b)/is,
		mute: false,
		warnMessage: "Posible estafa detectada",
	},
];

export const scamFilterList: RegExp[] = [
	/free\s+bonus\s+code/i,
	/crypto\s+casino/i,
	/receive\s+your\s*\$\d*/i,
	/belowex/i,
	/evencas/i,
	/special\s+promo\s+code/i,
	/bonus\s+instantly/i,
	/deleted\s+one\s+hour/i,
	/claim\s+your\s+reward/i,
	/free\s+gift\s+code/i,
	/free\s+gift\s+codes/i,
	/free\s+gift\s+code\s+now/i,
	/take\s+your\s+free\s+reward/i,
];