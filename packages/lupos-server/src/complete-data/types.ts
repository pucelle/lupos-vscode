import type * as TS from 'typescript'


export interface CompletionItem extends CompletionDataItem {

	readonly name: string

	/** Custom completion kind. */
	readonly kind?: TS.ScriptElementKind

	/** The completion start position in template origin. */
	readonly start?: number

	/** The completion end position in template origin. */
	readonly end?: number

	/** Decide sort order, normally default value is `0`. */
	readonly order?: number

	/** 
	 * After name, normally type info.
	 * Only get showed it in info.
	 */
	readonly infoDetail?: string

	/** 
	 * After name and info description, normally short description.
	 * Only get showed it in info.
	 */
	readonly infoDescription?: string

	/** 
	 * Detail, normally detailed type info or header.
	 * Only get showed it in entry detail.
	 */
	readonly detail?: string

	/** 
	 * Description text, like documentation.
	 * Only get showed it in entry detail.
	 */
	readonly description: string
}
