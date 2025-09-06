import type * as TS from 'typescript'


export interface CompletionItem extends CompletionDataItem {
	readonly name: string

	/** After name, normally type info. */
	readonly detail?: string

	/** Description text, but not documentation. */
	readonly description: string

	/** Decide sort order, normally default value is `0`. */
	readonly order?: number

	/** Custom completion kind. */
	readonly kind?: TS.ScriptElementKind

	/** If completion for specified node. */
	readonly node?: TS.Node
}
