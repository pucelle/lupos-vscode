import type * as TS from 'typescript'


export type CompletionItem = {
	readonly name: string
	readonly description: string

	/** If want to overwrite replacement range. */
	readonly start?: number
	readonly end?: number

	/** Decide sort order, normally default value is `0`. */
	readonly order?: number

	readonly kind?: TS.ScriptElementKind
}

export interface CompletionBooleanAttributeItem extends CompletionItem {
	forElements?: string[]
}