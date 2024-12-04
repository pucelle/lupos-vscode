type CompletionItem = {
	readonly name: string
	readonly description: string

	/** If want to overwrite replacement range. */
	readonly start?: number
	readonly end?: number
}

interface CompletionBooleanAttributeItem extends CompletionItem {
	forElements?: string[]
}