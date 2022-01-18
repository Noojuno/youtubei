import { Chat } from ".";
import { YoutubeRawData } from "../common";
import { ChatAttributes } from "./Chat";

interface SuperChatColors {
	headerBackground: number;
	headerText: number;
	bodyBackground: number;
	bodyText: number;
}

export interface SuperChatAttributes extends ChatAttributes {
	purchaseAmount: string;
	colors: SuperChatColors;
}

/** Represents a chat in a live stream */
export default class SuperChat extends Chat implements SuperChatAttributes {
	/** Purchase amount in string form including currency (e.g NZ$2.00) */
	purchaseAmount!: string;
	/** Colors of the super chat box */
	colors!: SuperChatColors;

	/** @hidden */
	constructor(chat: Partial<SuperChatAttributes> = {}) {
		super();
		Object.assign(this, chat);
	}

	/**
	 * Load this instance with raw data from Youtube
	 *
	 * @hidden
	 */
	load(data: YoutubeRawData): Chat {
		super.load(data);

		const {
			purchaseAmountText,
			headerBackgroundColor,
			headerTextColor,
			bodyBackgroundColor,
			bodyTextColor,
		} = data;

		// Basic information
		this.purchaseAmount = purchaseAmountText?.simpleText;

		this.colors = {
			headerBackground: headerBackgroundColor,
			headerText: headerTextColor,
			bodyBackground: bodyBackgroundColor,
			bodyText: bodyTextColor,
		};

		return this;
	}
}
