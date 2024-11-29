import type * as TS from 'typescript'
import {ProjectContext} from '../core'
import {HTMLRoot, TemplateSlotPlaceholder, PositionMapper, TemplateSlotParser, TemplateSlot} from '../lupos-ts-module'
import {TemplateEmbeddedRegions} from './embedded-regions'
import {Position} from 'vscode-languageserver-types'
import {OriginTranslator} from './types'


/** If source file not changed, TemplateContext will keep same for same template. */
export class Template implements OriginTranslator {

	readonly node: TS.TemplateLiteral
	readonly tagName: 'html' | 'svg' | 'css'
	readonly context: ProjectContext
	readonly globalStart: number
	readonly globalEnd: number

	readonly sourceFile: TS.SourceFile
	readonly fileName: string
	readonly root: HTMLRoot

	/** Contents of the template string, Has substitutions replaced to `$LUPOS_SLOT_INDEX_\D$`. */
	readonly content: string

	/** Map virtual document offset to original offset in whole ts document. */
	readonly positionMapper: PositionMapper

	/** All embedded documents, include document of current template. */
	readonly embedded: TemplateEmbeddedRegions

	/** Help to parse template slots. */
	readonly slotParser: TemplateSlotParser

	/** Parsed template slots. */
	readonly slots: TemplateSlot[] = []

	constructor(tagName: 'html' | 'svg' | 'css', node: TS.TemplateLiteral, context: ProjectContext) {
		this.tagName = tagName
		this.node = node
		this.context = context
		this.sourceFile = node.getSourceFile()
		this.fileName = node.getSourceFile().fileName
		this.globalStart = this.node.getStart() + 1
		this.globalEnd = this.node.getEnd() - 1

		let {string, mapper} = TemplateSlotPlaceholder.toTemplateString(node)
		let valueNodes = TemplateSlotPlaceholder.extractTemplateValues(node)
		let root = HTMLRoot.fromString(string)

		this.content = string
		this.positionMapper = mapper
		this.root = root
		this.embedded = new TemplateEmbeddedRegions(this)
		this.slotParser = new TemplateSlotParser(root, valueNodes, this.onSlot.bind(this), this.context.helper)
	}

	/** Add slot to slot list. */
	private onSlot(slot: TemplateSlot) {
		this.slots.push(slot)
	}

	/** Get slot at specified position. */
	getSlotAt(temOffset: number): TemplateSlot | undefined {
		for (let slot of this.slots) {
			if (slot.start <= temOffset && slot.end >= temOffset) {
				return slot
			}
		}

		return undefined
	}

	/** Returns text document of whole template. */
	get document() {
		return this.embedded.getWholeTemplateRegion().document
	}

	/** Convert template offset to local offset. */
	templateOffsetToLocal(templateOffset: number): number {
		return templateOffset
	}

	/** Convert local offset to template offset. */
	localOffsetToTemplate(localOffset: number): number {
		return localOffset
	}

	/** Convert global offset to local offset. */
	globalOffsetToLocal(globalOffset: number): number {
		return this.positionMapper.backMap(globalOffset)
	}

	/** Convert local offset to global offset. */
	localOffsetToGlobal(localOffset: number): number {
		return this.positionMapper.map(localOffset)
	}
	
	/** Transfer a local offset to equivalent local position. */
	localOffsetToPosition(localOffset: number): Position {
		return this.embedded.getWholeTemplateRegion().localOffsetToPosition(localOffset)
	}

	/** Transfer a local position to equivalent local offset. */
	localPositionToOffset(localOffset: Position): number {
		return this.embedded.getWholeTemplateRegion().localPositionToOffset(localOffset)
	}

	/** Convert local offset to global offset. */
	localOffsetToGlobalPosition(localOffset: number): number {
		return this.positionMapper.map(localOffset)
	}

	/** Check whether a global offset inside current template range. */
	intersectWith(globalStart: number, globalEnd: number): boolean {
		return !(globalEnd < this.globalStart || globalStart > globalEnd)
	}
}