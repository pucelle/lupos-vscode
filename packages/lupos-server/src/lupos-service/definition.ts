import type * as TS from 'typescript'
import {WorkSpaceAnalyzer} from './analyzer'
import {Template} from '../template-service'
import {TemplatePart, TemplatePartPiece, TemplatePartPieceType, TemplatePartType} from '../lupos-ts-module'
import {ProjectContext} from '../core'
import {DefinitionItem, makeDefinitionInfo} from './helpers/definition-converter'
import {getTemplateValueDefinitionItem} from './template-value-service/definition'


/** Provide lupos definition service. */
export class LuposDefinition {

	readonly analyzer: WorkSpaceAnalyzer
	readonly context: ProjectContext

	constructor(analyzer: WorkSpaceAnalyzer) {
		this.analyzer = analyzer
		this.context = analyzer.context
	}
	
	getDefinition(part: TemplatePart, piece: TemplatePartPiece, template: Template, temOffset: number): TS.DefinitionInfoAndBoundSpan | undefined {
		let item: DefinitionItem | undefined

		// `<A`
		if (part.type === TemplatePartType.Component) {
			let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
			item = component
		}

		// :xxx
		else if (part.type === TemplatePartType.Binding) {
			let binding = this.getBindingDefinition(part, piece, template)
			item = binding
		}

		// .xxx
		else if (part.type === TemplatePartType.Property) {
			if (piece.type === TemplatePartPieceType.Name) {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let property = component ? this.analyzer.getComponentProperty(component, part.mainName!) : undefined

				item = property
			}
		}

		// @xxx
		else if (part.type === TemplatePartType.Event) {
			if (piece.type === TemplatePartPieceType.Name) {
				let component = this.analyzer.getComponentByTagName(part.node.tagName!, template)
				let event = component ? this.analyzer.getComponentEvent(component, part.mainName!) : undefined

				item = event
			}
		}

		// `.value=${{property}}`, goto definition for `property.`
		if (!item) {
			item = getTemplateValueDefinitionItem(part, piece, template, temOffset, this.analyzer)
		}

		if (!item) {
			return undefined
		}

		return makeDefinitionInfo(item, part, piece)
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
}