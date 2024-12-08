type CompletionItem = {
	readonly name: string
	readonly description: string

	/** If want to overwrite replacement range. */
	readonly start?: number
	readonly end?: number

	/** Decide sort order, normally default value is `0`. */
	readonly order?: number
}

interface CompletionBooleanAttributeItem extends CompletionItem {
	forElements?: string[]
}