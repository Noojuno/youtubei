import { Base, ChannelCompact, Video, BaseAttributes, Thumbnails } from ".";
import { YoutubeRawData } from "../common";

/** @hidden */
export interface ChatAttributes extends BaseAttributes {
	video: Video;
	author: ChannelCompact;
	message: string;
	timestamp: number;
	badges?: Badge[];
	emotes?: Emote[];
}

interface Badge {
	name: string;
	thumbnails?: Thumbnails;
	icon?: string;
}

interface Emote {
	id: string;
	thumbnails: Thumbnails;
	startIndex: number;
	endIndex: number;
}

/** Represents a chat in a live stream */
export default class Chat extends Base implements ChatAttributes {
	/** The video this chat belongs to */
	video!: Video;
	/** The chat's author */
	author!: ChannelCompact;
	/** The message of this chat */
	message: string = "";
	/** Timestamp in usec / microsecond */
	timestamp!: number;
	/** Badges next to users name in chat */
	badges!: Badge[];
	/** Emote information */
	emotes: Emote[] = [];

	/** @hidden */
	constructor(chat: Partial<ChatAttributes> = {}) {
		super();
		Object.assign(this, chat);
	}

	/**
	 * Load this instance with raw data from Youtube
	 *
	 * @hidden
	 */
	load(data: YoutubeRawData): Chat {
		const {
			id,
			message,
			authorName,
			authorPhoto,
			timestampUsec,
			authorExternalChannelId,
			authorBadges,
		} = data;

		// Basic information
		this.id = id;

		message.runs.forEach((r: YoutubeRawData) => {
			if (r.emoji) {
				const text: string = r.emoji?.shortcuts[0] || r.emoji.emojiId;
				const emote: Emote = {
					id: r.emoji.emojiId,
					thumbnails: new Thumbnails().load(r.emoji.image.thumbnails || {}),
					startIndex: this.message.length,
					endIndex: this.message.length + text.length,
				};

				this.emotes = [...this.emotes, emote];

				this.message += text;
				return;
			}

			this.message += r.text;
		});
		this.author = new ChannelCompact({
			id: authorExternalChannelId,
			name: authorName.simpleText,
			thumbnails: authorPhoto.thumbnails,
			client: this.client,
		});
		this.badges = authorBadges?.map((r: YoutubeRawData) => {
			let badge: Badge = { name: r.tooltip };

			if (!r.liveChatAuthorBadgeRenderer.customThumbnail) {
				badge = { ...badge, icon: r.liveChatAuthorBadgeRenderer.icon.iconType };
			} else {
				badge = {
					...badge,
					thumbnails: new Thumbnails().load(
						r.liveChatAuthorBadgeRenderer.customThumbnail.thumbnails || {}
					),
				};
			}

			return badge;
		});

		this.timestamp = +timestampUsec;
		return this;
	}
}
