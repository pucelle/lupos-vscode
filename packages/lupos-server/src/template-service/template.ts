import type * as TS from 'typescript'
import {ProjectContext} from '../core'
import {TemplateBasis, TemplatePartParser, TemplatePart, TemplatePartType, ScopeTree, TemplateSlotPlaceholder, HTMLRoot} from '../lupos-ts-module'
import {TemplateEmbeddedRegions} from './embedded-regions'
import {Position} from 'vscode-languageserver-types'
import {OriginTranslator} from './types'


/** If source file doesn't changed, Template will keep same for same template. */
export class Template extends TemplateBasis implements OriginTranslator {

	readonly context: ProjectContext

	/** All embedded documents, include document of current template. */
	readonly embedded: TemplateEmbeddedRegions

	/** Parsed template slots. */
	readonly parts: TemplatePart[] = []

	constructor(tagName: 'html' | 'svg' | 'css', node: TS.TemplateLiteral, scopeTree: ScopeTree, context: ProjectContext) {
		let {string, mapper} = TemplateSlotPlaceholder.toTemplateContent(node)
		let valueNodes = TemplateSlotPlaceholder.extractTemplateValues(node)
		let root = HTMLRoot.fromString(string)

		super(tagName, node, string, root, valueNodes, mapper, scopeTree, context.helper)

		this.context = context
		this.embedded = new TemplateEmbeddedRegions(this)

		this.initParts()
	}

	private initParts() {
		let partsParser = new TemplatePartParser(this.root, this.valueNodes, false, this.onPart.bind(this), this.context.helper)
		partsParser.parse()

		// Print parts:
		// if (this.content.includes('LG')) {
		// 	Logger.log(this.content)

		// 	for (let part of this.parts) {
		// 		let p = {...part} as any
		// 		p.node = null

		// 		Logger.log(p)
		// 	}
		// }
	}

	/** Add part to part list. */
	private onPart(part: TemplatePart) {
		this.parts.push(part)
	}

	/** Get all the parts of template. */
	getAllParts(): TemplatePart[] {
		return this.parts
	}

	/** Get slot at specified position. */
	getPartAt(temOffset: number): TemplatePart | undefined {
		let part = this.findPartAt(temOffset)
		if (!part) {
			return undefined
		}

		// For completion of `<|`.
		if (part.type === TemplatePartType.SlottedText || part.type === TemplatePartType.UnSlottedText) {
			let offset = temOffset - part.start
			let text = part.node.text!

			// `<|`
			if (text[offset - 1] === '<'
				&& (offset === text.length || !/\w/.test(text[offset]))
			) {
				return {
					type: TemplatePartType.NormalStartTag,
					rawName: null,
					namePrefix: null,
					mainName: null,
					modifiers: null,
					strings: null,
					valueIndices: null,
					node: part.node,
					attr: null,
					start: temOffset,
					end: temOffset,
				}
			}
		}

		return part
	}

	private findPartAt(temOffset: number): TemplatePart | undefined  {
		for (let part of this.parts) {

			// `|a` not match
			// `a|` match
			if (part.start <= temOffset && part.end >= temOffset) {
				return part
			}
		}

		return undefined
	}

	/** Returns text document of whole template. */
	get document() {
		return this.embedded.getWholeTemplateRegion().document
	}

	/** Transfer a local offset to equivalent local position. */
	localOffsetToPosition(localOffset: number): Position {
		return this.embedded.getWholeTemplateRegion().localOffsetToPosition(localOffset)
	}

	/** Transfer a local position to equivalent local offset. */
	localPositionToOffset(localOffset: Position): number {
		return this.embedded.getWholeTemplateRegion().localPositionToOffset(localOffset)
	}

	/** Check whether a global offset inside current template range. */
	intersectWith(globalStart: number, globalEnd: number): boolean {
		return !(globalEnd < this.globalStart || globalStart > globalEnd)
	}
}