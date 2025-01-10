import type * as TS from 'typescript'


export interface CompletionItem extends CompletionDataItem {
	readonly name: string
	readonly description: string

	/** Decide sort order, normally default value is `0`. */
	readonly order?: number

	readonly kind?: TS.ScriptElementKind
}
