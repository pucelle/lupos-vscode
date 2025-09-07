import type * as TS from 'typescript'


export interface CompletionItem extends CompletionDataItem {
	readonly name: string

	/** 
	 * After name, normally type info.
	 * Only show it in entry detail.
	 */
	readonly detail?: string

	/** 
	 * Description text, like documentation.
	 * Only show it in entry detail.
	 */
	readonly description: string

	/** Decide sort order, normally default value is `0`. */
	readonly order?: number

	/** Custom completion kind. */
	readonly kind?: TS.ScriptElementKind

	/** The completion start position in template origin. */
	readonly start?: number

	/** The completion end position in template origin. */
	readonly end?: number
}
