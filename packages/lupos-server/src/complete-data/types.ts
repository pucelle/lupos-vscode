type CompleteDataItem = {
	readonly name: string
	readonly description: string
}

interface CompleteBooleanAttribute extends CompleteDataItem {
	forElements?: string[]
}