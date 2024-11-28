import type * as TS from 'typescript'


export interface LuposItem {

	/** Defined name, class name or property name. */
	readonly name: string

	/** Node of it's defined name. */
	readonly nameNode: TS.Node

	/** Description is leading comment of definition. */
	readonly description: string | null

	/** Type of item. */
	readonly type: TS.Type

	/** Source file in. */
	readonly sourceFile: TS.SourceFile
}

export interface LuposProperty extends LuposItem {

	/** Whether property is public. */
	readonly public: boolean
}

/** Lupos event. */
export interface LuposEvent extends LuposItem {}

export interface LuposBinding extends LuposItem {

	/** Defined class declaration. */
	readonly declaration: TS.ClassLikeDeclaration
}

export interface LuposComponent extends LuposItem {

	/** Defined class declaration. */
	readonly declaration: TS.ClassLikeDeclaration

	/** Component public properties, not include properties of super class. */
	readonly properties: Map<string, LuposProperty>

	/** Component events. */
	readonly events: Map<string, LuposEvent>

	/** Component refs. */
	readonly refs: Map<string, LuposProperty>

	/** Component slots. */
	readonly slots: Map<string, LuposProperty>
}
