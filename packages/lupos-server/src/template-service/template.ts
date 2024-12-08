import type * as TS from 'typescript'
import {ProjectContext, ts} from '../core'
import {HTMLRoot, TemplateSlotPlaceholder, PositionMapper, TemplatePartParser, TemplatePart, TemplatePartType, ScopeTree} from '../lupos-ts-module'
import {TemplateEmbeddedRegions} from './embedded-regions'
import {Position} from 'vscode-languageserver-types'
import {OriginTranslator} from './types'


/** If source file not changed, TemplateContext will keep same for same template. */
export class Template implements OriginTranslator {

	readonly tagName: 'html' | 'svg' | 'css'
	readonly node: TS.TemplateLiteral
	readonly scopeTree: ScopeTree
	readonly context: ProjectContext
	readonly globalStart: number
	readonly globalEnd: number

	readonly sourceFile: TS.SourceFile
	readonly component: TS.ClassDeclaration
	readonly fileName: string
	readonly root: HTMLRoot
	readonly valueNodes: TS.Node[]

	/** Contents of the template string, Has substitutions replaced to `$LUPOS_SLOT_INDEX_\D$`. */
	readonly content: string

	/** Map virtual document offset to original offset in whole ts document. */
	readonly positionMapper: PositionMapper

	/** All embedded documents, include document of current template. */
	readonly embedded: TemplateEmbeddedRegions

	/** Parsed template slots. */
	readonly parts: TemplatePart[] = []

	constructor(tagName: 'html' | 'svg' | 'css', node: TS.TemplateLiteral, scopeTree: ScopeTree, context: ProjectContext) {
		this.tagName = tagName
		this.node = node
		this.scopeTree = scopeTree
		this.context = context

		this.component = context.helper.findOutward(node, ts.isClassDeclaration)!
		this.sourceFile = node.getSourceFile()
		this.fileName = node.getSourceFile().fileName
		this.globalStart = node.getStart() + 1
		this.globalEnd = node.getEnd() - 1

		let {string, mapper} = TemplateSlotPlaceholder.toTemplateString(node)
		let valueNodes = TemplateSlotPlaceholder.extractTemplateValues(node)
		let root = HTMLRoot.fromString(string)

		this.valueNodes = valueNodes
		this.content = string
		this.positionMapper = mapper
		this.root = root
		this.embedded = new TemplateEmbeddedRegions(this)

		let partsParser = new TemplatePartParser(root, valueNodes, false, this.onPart.bind(this), this.context.helper)
		partsParser.parse()

		// Print parts:
		// if (this.content.includes('<AsyncLiveRepeat')) {
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

	/** Get imported or declared by name. */
	getDeclarationOrReferenceByName(name: string): TS.Node | undefined {
		let importedOrDeclared = this.scopeTree.getDeclarationOrReferenceByName(name, this.node)
		return importedOrDeclared
	}

	/** Try resolve component declarations by part. */
	*resolveComponentDeclarations(part: TemplatePart): Iterable<TS.ClassLikeDeclaration> {
		let tagName = part.node.tagName!
		let isNamedComponent = TemplateSlotPlaceholder.isNamedComponent(tagName)
		let isDynamicComponent = TemplateSlotPlaceholder.isDynamicComponent(tagName)

		if (!isNamedComponent && !isDynamicComponent) {
			return
		}

		// Resolve class declarations directly.
		if (isNamedComponent) {
			let ref = this.scopeTree.getDeclarationOrReferenceByName(tagName, this.node)
			if (!ref) {
				return
			}

			let decls = this.context.helper.symbol.resolveDeclarations(ref, ts.isClassDeclaration)
			if (decls) {
				yield* decls
			}
		}

		// Resolve instance type of constructor interface.
		else {
			let ref = this.valueNodes[TemplateSlotPlaceholder.getUniqueSlotIndex(tagName)!]
			let decls = this.context.helper.symbol.resolveDeclarations(ref, ts.isClassDeclaration)
			if (decls && decls.length > 0) {
				yield* decls
				return
			}

			// Note made type node can't be resolved.
			let typeNode = this.context.helper.types.getOrMakeTypeNode(ref)
			if (typeNode) {
				yield* this.context.helper.symbol.resolveInstanceDeclarations(typeNode)
				return
			}
		}
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