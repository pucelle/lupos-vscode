import type * as TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer'
import {getScriptElementKind} from './utils'
import {Template} from '../template-service'
import {LuposItem, TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType} from '../lupos-ts-module'
import {ProjectContext} from '../core'


/** Provide lupos definition service. */
export class LuposDefinition {

	readonly analyzer: WorkSpaceAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: WorkSpaceAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}
	
	getDefinition(part: TemplatePart, piece: TemplatePartPiece, template: Template): TS.DefinitionInfoAndBoundSpan | undefined {

		// `<A`
		if (part.type === TemplatePartType.Component) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			return this.makeDefinitionInfo(component, part, piece)
		}

		// :xxx
		else if (part.type === TemplatePartType.Binding) {
			let item = this.getBindingDefinition(part, piece, template)
			return this.makeDefinitionInfo(item, part, piece)
		}

		// .xxx
		else if (part.type === TemplatePartType.Property) {
			if (piece.type === TemplatePartPieceType.Name) {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let property = component ? this.analyzer.getComponentProperty(component, part.mainName!) : undefined

				return this.makeDefinitionInfo(property, part, piece)
			}
		}

		// @xxx
		else if (part.type === TemplatePartType.Event) {
			if (piece.type === TemplatePartPieceType.Name) {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let event = component ? this.analyzer.getComponentEvent(component, part.mainName!) : undefined
				return this.makeDefinitionInfo(event, part, piece)
			}
		}

		return undefined
	}
	
	private getBindingDefinition(part: TemplatePart, piece: TemplatePartPiece, template: Template) {
		let attr = part.attr!
		let mainName = part.mainName!

		// `:name|`, complete binding name.
		if (piece.type === TemplatePartPieceType.Name) {
			let binding = this.analyzer.getBindingByName(mainName, template)
			return binding
		}
		
		// If `:slot="|"`.
		else if (piece.type === TemplatePartPieceType.Modifier) {
			if (mainName === 'slot') {
				let attrValue = attr.value!
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let property = component ? this.analyzer.getComponentSubProperties(component, 'slotElements', attrValue) : undefined

				return property
			}
		}

		return undefined
	}

	private makeDefinitionInfo(item: LuposItem | undefined, part: TemplatePart, piece: TemplatePartPiece): TS.DefinitionInfoAndBoundSpan | undefined{
		if (!item) {
			return undefined
		}

		let nameNode = item.nameNode
		let name = item.name
		let kind = getScriptElementKind(item, part, piece)
		let fileName = nameNode.getSourceFile().fileName

		let textSpan: TS.TextSpan = {
			start: nameNode.getStart(),
			length: nameNode.getWidth(),
		}

		let info: TS.DefinitionInfo = {
			textSpan,
			fileName,
			kind,
			name,
			containerName: fileName,
			containerKind: this.context.helper.ts.ScriptElementKind.scriptElement,
		}

		// Not include modifiers.
		let length = piece.end - piece.start

		let fromTextSpan = {
			start: piece.start,
			length,
		}

		return {
			definitions: [info],
			textSpan: fromTextSpan,
		}
	}
}